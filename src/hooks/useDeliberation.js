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
import { createModelConfig, MODEL_DISPLAY } from '../utils/models';

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
    enabledModels: ['openai', 'anthropic', 'google'],
    modelConfigs: {}, // { provider: { model: 'custom-model-id' } }
    currentRound: 1,
    rounds: [],
    phase: 'setup', // setup | deliberation | synthesis | complete
    synthesis: { prompt: '', response: '', loading: false },
    synthesisModel: { provider: 'openai', model: null },
    createdAt: null,
    completedAt: null
});

const createInitialSettings = () => ({
    isAutomated: true,
    useOpenRouter: false
});

const PREFERENCES_KEY = 'rationallm_preferences';

export function useDeliberation() {
    const [state, setState] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        try {
            if (saved) {
                const parsed = JSON.parse(saved);
                // Allow restoring setup phase to keep query draft
                if (parsed) return parsed;
            }

            // If no active session, load preferences for defaults
            const savedPreferences = localStorage.getItem(PREFERENCES_KEY);
            let initialEnabled = [];
            let initialConfigs = {};
            let initialSynthesisModel = { provider: 'openai', model: null };

            if (savedPreferences) {
                const prefs = JSON.parse(savedPreferences);
                if (prefs) {
                    initialEnabled = prefs.enabledModels || [];
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
                    const validKeys = Object.keys(keys).filter(k => keys[k] && k !== 'openrouter');
                    if (validKeys.length > 0) {
                        initialEnabled = validKeys;
                    } else if (keys.openrouter) {
                        initialEnabled = ['openai', 'anthropic', 'google'];
                    }
                }
            }


            return {
                ...createInitialState(),
                enabledModels: initialEnabled,
                modelConfigs: initialConfigs,
                synthesisModel: initialSynthesisModel
            };
        } catch (e) {
            console.error('Failed to restore state:', e);
            return createInitialState();
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
            modelConfigs: state.modelConfigs,
            synthesisModel: state.synthesisModel
        };
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
    }, [state.enabledModels, state.modelConfigs, state.synthesisModel]);

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

    // Update API keys
    const setApiKeys = useCallback((newKeys) => {
        // Check if we should auto-enable any models
        const newlyEnabled = [];
        Object.entries(newKeys).forEach(([provider, key]) => {
            const wasEmpty = !apiKeys[provider] || !apiKeys[provider].trim();
            const isNowFilled = key && key.trim().length > 0;

            if (wasEmpty && isNowFilled) {
                if (provider === 'openrouter') {
                    // OpenRouter enables the big three by default
                    ['openai', 'anthropic', 'google'].forEach(m => newlyEnabled.push(m));
                } else {
                    newlyEnabled.push(provider);
                }
            }
        });

        if (newlyEnabled.length > 0) {
            setState(prev => {
                const nextEnabled = [...prev.enabledModels];
                newlyEnabled.forEach(m => {
                    if (!nextEnabled.includes(m)) nextEnabled.push(m);
                });
                return { ...prev, enabledModels: nextEnabled };
            });
        }

        setApiKeysState(prev => ({ ...prev, ...newKeys }));
    }, [apiKeys]);

    // Update settings
    const setSettings = useCallback((newSettings) => {
        setSettingsState(prev => ({ ...prev, ...newSettings }));
    }, []);

    // Toggle model selection
    const toggleModel = useCallback((modelId) => {
        setState(prev => {
            const models = prev.enabledModels.includes(modelId)
                ? prev.enabledModels.filter(m => m !== modelId)
                : [...prev.enabledModels, modelId];
            return { ...prev, enabledModels: models };
        });
    }, []);

    // Set custom model for a provider
    const setModelConfig = useCallback((provider, model) => {
        setState(prev => ({
            ...prev,
            modelConfigs: {
                ...prev.modelConfigs,
                [provider]: { model }
            }
        }));
    }, []);

    // Set synthesis model
    const setSynthesisModel = useCallback((provider, model = null) => {
        setState(prev => ({
            ...prev,
            synthesisModel: { provider, model }
        }));
    }, []);

    // Update query
    const setQuery = useCallback((query) => {
        setState(prev => ({ ...prev, query }));
    }, []);

    // Get model config for a provider
    const getModelConfig = useCallback((provider) => {
        const customModel = state.modelConfigs[provider]?.model || null;
        return createModelConfig(provider, customModel);
    }, [state.modelConfigs]);

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
                status: parseStatus(text),
                loading: false,
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
            const modelConfigs = state.enabledModels.map(provider => getModelConfig(provider));

            // Generate prompts for each model
            const getPromptForConfig = (config) => {
                if (state.currentRound === 1) {
                    return generateRound1Prompt(state.query);
                }

                const prevRoundResponses = state.rounds[state.currentRound - 2]?.responses || {};
                const ownResponse = prevRoundResponses[config.provider]?.text || '';
                const othersResponses = {};

                state.enabledModels.forEach(id => {
                    if (id !== config.provider) {
                        othersResponses[id] = prevRoundResponses[id]?.text || '';
                    }
                });

                return generateRoundNPrompt(state.query, config.provider, ownResponse, othersResponses);
            };

            // Update loading states
            state.enabledModels.forEach(provider => {
                updateResponseState(provider, { loading: true, error: null });
            });

            // Call all models
            const results = await callMultipleModels(
                modelConfigs,
                getPromptForConfig,
                apiKeys,
                settings.useOpenRouter,
                (provider, status, error) => {
                    if (status === 'loading') {
                        updateResponseState(provider, { loading: true });
                    } else if (status === 'error') {
                        updateResponseState(provider, { loading: false, error });
                    }
                }
            );

            // Update responses
            Object.entries(results).forEach(([provider, result]) => {
                if (result.success) {
                    updateResponse(provider, result.text);
                } else {
                    updateResponseState(provider, { loading: false, error: result.error });
                }
            });

        } catch (error) {
            console.error('Automated round failed:', error);
        } finally {
            setIsRunning(false);
        }
    }, [isRunning, state.enabledModels, state.currentRound, state.rounds, state.query, getModelConfig, apiKeys, settings.useOpenRouter, updateResponse, updateResponseState]);

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
                        prompt: generateSynthesisPrompt(prev.query, finalResponses, prev.currentRound),
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
            const config = createModelConfig(
                state.synthesisModel.provider,
                state.synthesisModel.model
            );

            const response = await callLLM(
                config,
                state.synthesis.prompt,
                apiKeys,
                settings.useOpenRouter
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
    }, [isRunning, state.synthesisModel, state.synthesis.prompt, apiKeys, settings.useOpenRouter]);

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
            modelConfigs: prev.modelConfigs,
            synthesisModel: prev.synthesisModel
        }));
    }, []);

    // Load from history
    const loadFromHistory = useCallback((deliberation) => {
        setState(deliberation);
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

        return generateRoundNPrompt(state.query, modelId, ownResponse, othersResponses);
    }, [state.query, state.currentRound, state.rounds, state.enabledModels]);

    // Check if automation is possible (has required API keys)
    const canAutomate = useCallback(() => {
        if (settings.useOpenRouter && apiKeys.openrouter) {
            return true;
        }
        // Check if all enabled models have API keys
        return state.enabledModels.every(provider => !!apiKeys[provider]);
    }, [settings.useOpenRouter, apiKeys, state.enabledModels]);

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
        setModelConfig,
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
