import { useState, useEffect, useCallback } from 'react';
import {
    generateRound1Prompt,
    generateRoundNPrompt,
    generateSynthesisPrompt,
    parseStatus,
    shouldProceedToSynthesis,
    allResponsesFilled,
    generateId
} from '../utils/prompts';
import { callLLM, callMultipleModels } from '../utils/api';
import { makeParticipant, getParticipantInfo, hasApiKeyForProvider, DEFAULT_MODELS } from '../utils/models';

const STORAGE_KEY = 'rationallm_current';
const HISTORY_KEY = 'rationallm_history';
const API_KEYS_KEY = 'rationallm_api_keys';
const SETTINGS_KEY = 'rationallm_settings';
const MAX_ROUNDS = 5;

const createEmptyResponses = (enabledModels) => {
    const responses = {};
    enabledModels.forEach(id => {
        responses[id] = { text: '', status: null, loading: false, error: null };
    });
    return responses;
};

const createInitialState = () => ({
    id: null,
    query: '',
    // enabledModels holds participant ids; participants maps id -> {provider, model, label, color}
    enabledModels: ['openai', 'anthropic', 'google'],
    participants: {},
    currentRound: 1,
    rounds: [],
    phase: 'setup', // setup | deliberation | synthesis | complete
    synthesis: { prompt: '', response: '', loading: false },
    synthesisModel: { provider: 'openai', model: null, label: null },
    createdAt: null,
    completedAt: null
});

const createInitialSettings = () => ({
    isAutomated: true,
    // Local servers load one model at a time; parallel requests thrash.
    // Off = fire local calls in parallel (server with VRAM to spare).
    serialLocal: true
});

// Old state shapes keyed everything by bare provider id with an optional
// modelConfigs override; rebuild a participants map with the same ids so
// saved responses still line up.
const migrateDeliberation = (d) => {
    if (!d) return d;
    if (d.participants && Object.keys(d.participants).length > 0) return d;
    const participants = {};
    (d.enabledModels || []).forEach(id => {
        participants[id] = {
            ...makeParticipant(id),
            model: d.modelConfigs?.[id]?.model || null
        };
    });
    return { ...d, participants };
};

// participant id -> label map for prompt generation and status parsing
const labelsOf = (state) => Object.fromEntries(
    (state.enabledModels || []).map(id => [id, getParticipantInfo(state.participants, id).label])
);

const PREFERENCES_KEY = 'rationallm_preferences';

export function useDeliberation() {
    const [state, setState] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        try {
            if (saved) {
                const parsed = JSON.parse(saved);
                // Allow restoring setup phase to keep query draft
                if (parsed) return migrateDeliberation(parsed);
            }

            // If no active session, load preferences for defaults
            const savedPreferences = localStorage.getItem(PREFERENCES_KEY);
            let initialEnabled = [];
            let initialParticipants = null;
            let initialConfigs = {};
            let initialSynthesisModel = { provider: 'openai', model: null, label: null };

            if (savedPreferences) {
                const prefs = JSON.parse(savedPreferences);
                if (prefs) {
                    initialEnabled = prefs.enabledModels || [];
                    initialParticipants = prefs.participants || null;
                    initialConfigs = prefs.modelConfigs || {};
                    if (prefs.synthesisModel) {
                        initialSynthesisModel = prefs.synthesisModel;
                    }
                }
            }

            // Fallback to auto-detection from keys if no preferences
            if (initialEnabled.length === 0) {
                const savedKeys = localStorage.getItem(API_KEYS_KEY);
                if (savedKeys) {
                    const keys = JSON.parse(savedKeys) || {};
                    const validKeys = Object.keys(keys)
                        .filter(k => keys[k] && k !== 'openrouter' && k !== 'ollama');
                    if (validKeys.length > 0) {
                        initialEnabled = validKeys;
                    }
                }
            }

            return migrateDeliberation({
                ...createInitialState(),
                enabledModels: initialEnabled,
                participants: initialParticipants || {},
                modelConfigs: initialConfigs,
                synthesisModel: initialSynthesisModel
            });
        } catch (e) {
            console.error('Failed to restore state:', e);
            return migrateDeliberation(createInitialState());
        }
    });

    const [history, setHistory] = useState(() => {
        const saved = localStorage.getItem(HISTORY_KEY);
        try {
            const parsed = saved ? JSON.parse(saved) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Failed to restore history:', e);
            return [];
        }
    });

    const [apiKeys, setApiKeysState] = useState(() => {
        const saved = localStorage.getItem(API_KEYS_KEY);
        try {
            const parsed = saved ? JSON.parse(saved) : {};
            return parsed || {};
        } catch (e) {
            console.error('Failed to restore API keys:', e);
            return {};
        }
    });

    const [settings, setSettingsState] = useState(() => {
        const saved = localStorage.getItem(SETTINGS_KEY);
        try {
            return saved ? { ...createInitialSettings(), ...JSON.parse(saved) } : createInitialSettings();
        } catch (e) {
            console.error('Failed to restore settings:', e);
            return createInitialSettings();
        }
    });

    const [isRunning, setIsRunning] = useState(false);

    // Save state to localStorage on any change (including Setup phase)
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);

    // Save preferences explicitly
    useEffect(() => {
        const prefs = {
            enabledModels: state.enabledModels,
            participants: state.participants,
            synthesisModel: state.synthesisModel
        };
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
    }, [state.enabledModels, state.participants, state.synthesisModel]);

    // Save history to localStorage
    useEffect(() => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }, [history]);

    // Save API keys to localStorage
    useEffect(() => {
        localStorage.setItem(API_KEYS_KEY, JSON.stringify(apiKeys));
    }, [apiKeys]);

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }, [settings]);

    // Update API keys. Filling a direct provider key auto-adds that provider's
    // default model; OpenRouter/Ollama need an explicit model pick instead.
    const setApiKeys = useCallback((newKeys) => {
        const newlyEnabled = [];
        Object.entries(newKeys).forEach(([provider, key]) => {
            const wasEmpty = !apiKeys[provider] || !apiKeys[provider].trim();
            const isNowFilled = key && key.trim().length > 0;

            if (wasEmpty && isNowFilled && provider !== 'openrouter' && provider !== 'ollama') {
                newlyEnabled.push(provider);
            }
        });

        if (newlyEnabled.length > 0) {
            setState(prev => {
                const nextEnabled = [...prev.enabledModels];
                const nextParticipants = { ...prev.participants };
                newlyEnabled.forEach(p => {
                    // Pin the provider's default model explicitly so the
                    // participant is labeled with a concrete model name
                    const participant = makeParticipant(p, DEFAULT_MODELS[p] || null);
                    if (!nextEnabled.includes(participant.id)) {
                        nextEnabled.push(participant.id);
                        nextParticipants[participant.id] = participant;
                    }
                });
                return { ...prev, enabledModels: nextEnabled, participants: nextParticipants };
            });
        }

        setApiKeysState(prev => ({ ...prev, ...newKeys }));
    }, [apiKeys]);

    // Update settings
    const setSettings = useCallback((newSettings) => {
        setSettingsState(prev => ({ ...prev, ...newSettings }));
    }, []);

    // Toggle a participant on/off by id (manual-mode chips pass bare provider ids)
    const toggleModel = useCallback((id) => {
        setState(prev => {
            if (prev.enabledModels.includes(id)) {
                return { ...prev, enabledModels: prev.enabledModels.filter(m => m !== id) };
            }
            return {
                ...prev,
                participants: { ...prev.participants, [id]: getParticipantInfo(prev.participants, id) },
                enabledModels: [...prev.enabledModels, id]
            };
        });
    }, []);

    // Add a specific model from an endpoint as a deliberation participant
    const addParticipant = useCallback((provider, model = null) => {
        setState(prev => {
            const p = makeParticipant(provider, model);
            if (prev.enabledModels.includes(p.id)) return prev;
            // Disambiguate label collisions (e.g. same model on two endpoints)
            const usedLabels = prev.enabledModels.map(id => getParticipantInfo(prev.participants, id).label);
            const label = usedLabels.includes(p.label) && p.model ? p.model : p.label;
            return {
                ...prev,
                participants: { ...prev.participants, [p.id]: { ...p, label } },
                enabledModels: [...prev.enabledModels, p.id]
            };
        });
    }, []);

    // Set synthesis model
    const setSynthesisModel = useCallback((provider, model = null, label = null) => {
        setState(prev => ({
            ...prev,
            synthesisModel: { provider, model, label }
        }));
    }, []);

    // Update query
    const setQuery = useCallback((query) => {
        setState(prev => ({ ...prev, query }));
    }, []);

    // Get API call config for a participant
    const getModelConfig = useCallback((id) => {
        const info = getParticipantInfo(state.participants, id);
        return { id, provider: info.provider, model: info.model };
    }, [state.participants]);

    // Start deliberation
    const startDeliberation = useCallback(() => {
        setState(prev => {
            if (!prev.query.trim() || prev.enabledModels.length === 0) return prev;

            return {
                ...prev,
                id: generateId(),
                phase: 'deliberation',
                currentRound: 1,
                rounds: [{
                    number: 1,
                    responses: createEmptyResponses(prev.enabledModels)
                }],
                createdAt: Date.now()
            };
        });
    }, []);

    // Update response for a model (manual mode)
    const updateResponse = useCallback((modelId, text) => {
        setState(prev => {
            const currentRoundIndex = prev.currentRound - 1;
            const newRounds = [...prev.rounds];
            const currentRound = { ...newRounds[currentRoundIndex] };
            const responses = { ...currentRound.responses };

            responses[modelId] = {
                ...responses[modelId],
                text,
                status: parseStatus(text, Object.values(labelsOf(prev))),
                loading: false,
                pending: false,
                error: null
            };

            currentRound.responses = responses;
            newRounds[currentRoundIndex] = currentRound;

            return { ...prev, rounds: newRounds };
        });
    }, []);

    // Update response loading/error state
    const updateResponseState = useCallback((modelId, updates) => {
        setState(prev => {
            const currentRoundIndex = prev.currentRound - 1;
            const newRounds = [...prev.rounds];
            const currentRound = { ...newRounds[currentRoundIndex] };
            const responses = { ...currentRound.responses };

            responses[modelId] = {
                ...responses[modelId],
                ...updates
            };

            currentRound.responses = responses;
            newRounds[currentRoundIndex] = currentRound;

            return { ...prev, rounds: newRounds };
        });
    }, []);

    // Get current round responses
    const getCurrentResponses = useCallback(() => {
        if (state.rounds.length === 0) return {};
        return state.rounds[state.currentRound - 1]?.responses || {};
    }, [state.rounds, state.currentRound]);

    // Check if we can proceed to next round
    const canProceedToNextRound = useCallback(() => {
        const responses = getCurrentResponses();
        return allResponsesFilled(responses, state.enabledModels);
    }, [getCurrentResponses, state.enabledModels]);

    // Check if should show synthesis
    const shouldShowSynthesis = useCallback(() => {
        const responses = getCurrentResponses();
        if (!allResponsesFilled(responses, state.enabledModels)) return false;

        // If multiple models, force at least 2 rounds so they see others' answers
        const isMultiModel = state.enabledModels.length > 1;
        if (isMultiModel && state.currentRound < 2) return false;

        return shouldProceedToSynthesis(responses) || state.currentRound >= MAX_ROUNDS;
    }, [getCurrentResponses, state.enabledModels, state.currentRound]);

    // Run automated round
    const runAutomatedRound = useCallback(async () => {
        if (isRunning) return;
        setIsRunning(true);

        try {
            // Only call participants without a successful response this round,
            // so "Retry Failed" doesn't re-bill the models that succeeded
            const currentResponses = state.rounds[state.currentRound - 1]?.responses || {};
            const targets = state.enabledModels.filter(id => !currentResponses[id]?.text?.trim());
            if (targets.length === 0) return;

            const modelConfigs = targets.map(id => getModelConfig(id));
            const labels = labelsOf(state);

            // Generate prompts for each participant
            const getPromptForConfig = (config) => {
                if (state.currentRound === 1) {
                    return generateRound1Prompt(state.query);
                }

                const prevRoundResponses = state.rounds[state.currentRound - 2]?.responses || {};
                const ownResponse = prevRoundResponses[config.id]?.text || '';
                const othersResponses = {};

                state.enabledModels.forEach(id => {
                    if (id !== config.id) {
                        othersResponses[id] = prevRoundResponses[id]?.text || '';
                    }
                });

                return generateRoundNPrompt(state.query, config.id, ownResponse, othersResponses, labels);
            };

            // Mark all targets queued; each flips to loading when its call
            // actually starts (serial local models wait their turn)
            targets.forEach(id => {
                updateResponseState(id, { pending: true, loading: false, error: null });
            });

            // Call all pending models (local-server calls run serially when
            // serialLocal is on, to avoid model-swap thrashing)
            const results = await callMultipleModels(
                modelConfigs,
                getPromptForConfig,
                apiKeys,
                (id, status, error) => {
                    if (status === 'loading') {
                        updateResponseState(id, { loading: true, pending: false });
                    } else if (status === 'error') {
                        updateResponseState(id, { loading: false, pending: false, error });
                    }
                },
                { serialProviders: settings.serialLocal !== false ? ['ollama'] : [] }
            );

            // Update responses
            Object.entries(results).forEach(([id, result]) => {
                if (result.success) {
                    updateResponse(id, result.text);
                } else {
                    updateResponseState(id, { loading: false, pending: false, error: result.error });
                }
            });

        } catch (error) {
            console.error('Automated round failed:', error);
        } finally {
            setIsRunning(false);
        }
    }, [isRunning, state, getModelConfig, apiKeys, settings.serialLocal, updateResponse, updateResponseState]);

    // Proceed to next round
    const nextRound = useCallback(() => {
        setState(prev => {
            const responses = prev.rounds[prev.currentRound - 1]?.responses || {};

            // Check if should go to synthesis
            const isMultiModel = prev.enabledModels.length > 1;
            const minRounds = isMultiModel ? 2 : 1;

            const allSatisfied = shouldProceedToSynthesis(responses);
            const readyForSynthesis = (allSatisfied && prev.currentRound >= minRounds) || prev.currentRound >= MAX_ROUNDS;

            if (readyForSynthesis) {
                // Generate synthesis prompt
                const finalResponses = {};
                prev.enabledModels.forEach(id => {
                    finalResponses[id] = responses[id]?.text || '';
                });

                return {
                    ...prev,
                    phase: 'synthesis',
                    synthesis: {
                        prompt: generateSynthesisPrompt(prev.query, finalResponses, prev.currentRound, labelsOf(prev)),
                        response: '',
                        loading: false
                    }
                };
            }

            // Go to next round
            const nextRoundNum = prev.currentRound + 1;
            return {
                ...prev,
                currentRound: nextRoundNum,
                rounds: [
                    ...prev.rounds,
                    {
                        number: nextRoundNum,
                        responses: createEmptyResponses(prev.enabledModels)
                    }
                ]
            };
        });
    }, []);

    // Run automated synthesis
    const runAutomatedSynthesis = useCallback(async () => {
        if (isRunning) return;
        setIsRunning(true);

        setState(prev => ({
            ...prev,
            synthesis: { ...prev.synthesis, loading: true }
        }));

        try {
            const response = await callLLM(
                { provider: state.synthesisModel.provider, model: state.synthesisModel.model },
                state.synthesis.prompt,
                apiKeys
            );

            setState(prev => ({
                ...prev,
                synthesis: {
                    ...prev.synthesis,
                    response,
                    loading: false
                }
            }));
        } catch (error) {
            console.error('Synthesis failed:', error);
            setState(prev => ({
                ...prev,
                synthesis: {
                    ...prev.synthesis,
                    loading: false,
                    error: error.message
                }
            }));
        } finally {
            setIsRunning(false);
        }
    }, [isRunning, state.synthesisModel, state.synthesis.prompt, apiKeys]);

    // Update synthesis response (manual mode)
    const updateSynthesis = useCallback((response) => {
        setState(prev => ({
            ...prev,
            synthesis: { ...prev.synthesis, response }
        }));
    }, []);

    // Complete deliberation
    const complete = useCallback(() => {
        setState(prev => {
            const completedState = {
                ...prev,
                phase: 'complete',
                completedAt: Date.now()
            };

            // Add to history
            setHistory(h => [completedState, ...h].slice(0, 50)); // Keep last 50

            return completedState;
        });
    }, []);

    // Start new deliberation
    const startNew = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setState(prev => ({
            ...createInitialState(),
            enabledModels: prev.enabledModels,
            participants: prev.participants,
            synthesisModel: prev.synthesisModel
        }));
    }, []);

    // Load from history
    const loadFromHistory = useCallback((deliberation) => {
        setState(migrateDeliberation(deliberation));
    }, []);

    // Delete from history
    const deleteFromHistory = useCallback((id) => {
        setHistory(h => h.filter(d => d.id !== id));
    }, []);

    // Generate prompt for current round (for manual mode display)
    const getPromptForModel = useCallback((modelId) => {
        if (state.currentRound === 1) {
            return generateRound1Prompt(state.query);
        }

        const prevRoundResponses = state.rounds[state.currentRound - 2]?.responses || {};
        const ownResponse = prevRoundResponses[modelId]?.text || '';
        const othersResponses = {};

        state.enabledModels.forEach(id => {
            if (id !== modelId) {
                othersResponses[id] = prevRoundResponses[id]?.text || '';
            }
        });

        return generateRoundNPrompt(state.query, modelId, ownResponse, othersResponses, labelsOf(state));
    }, [state]);

    // Check if automation is possible (has required API keys)
    const canAutomate = useCallback(() => {
        return state.enabledModels.every(id =>
            hasApiKeyForProvider(apiKeys, getParticipantInfo(state.participants, id).provider)
        );
    }, [apiKeys, state.enabledModels, state.participants]);

    return {
        state,
        history,
        apiKeys,
        settings,
        isRunning,
        // Actions
        setQuery,
        setApiKeys,
        setSettings,
        toggleModel,
        addParticipant,
        setSynthesisModel,
        startDeliberation,
        updateResponse,
        nextRound,
        updateSynthesis,
        complete,
        startNew,
        loadFromHistory,
        deleteFromHistory,
        // Automation
        runAutomatedRound,
        runAutomatedSynthesis,
        canAutomate,
        // Helpers
        getPromptForModel,
        getModelConfig,
        getCurrentResponses,
        canProceedToNextRound,
        shouldShowSynthesis
    };
}
