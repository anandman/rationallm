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

const STORAGE_KEY = 'rationallm_current';
const HISTORY_KEY = 'rationallm_history';
const MAX_ROUNDS = 5;

const createEmptyResponses = (enabledModels) => {
    const responses = {};
    enabledModels.forEach(id => {
        responses[id] = { text: '', status: null };
    });
    return responses;
};

const createInitialState = () => ({
    id: null,
    query: '',
    enabledModels: ['claude', 'gpt', 'gemini'],
    currentRound: 1,
    rounds: [],
    phase: 'setup', // setup | deliberation | synthesis | complete
    synthesis: { prompt: '', response: '' },
    createdAt: null,
    completedAt: null
});

export function useDeliberation() {
    const [state, setState] = useState(createInitialState);
    const [history, setHistory] = useState([]);

    // Load state from localStorage on mount
    useEffect(() => {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed.phase !== 'setup') {
                    setState(parsed);
                }
            } catch (e) {
                console.error('Failed to restore state:', e);
            }
        }

        const savedHistory = localStorage.getItem(HISTORY_KEY);
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) {
                console.error('Failed to restore history:', e);
            }
        }
    }, []);

    // Save state to localStorage on change
    useEffect(() => {
        if (state.phase !== 'setup') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
    }, [state]);

    // Save history to localStorage on change
    useEffect(() => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }, [history]);

    // Toggle model selection
    const toggleModel = useCallback((modelId) => {
        setState(prev => {
            const models = prev.enabledModels.includes(modelId)
                ? prev.enabledModels.filter(m => m !== modelId)
                : [...prev.enabledModels, modelId];
            // Ensure at least one model is selected
            return models.length > 0 ? { ...prev, enabledModels: models } : prev;
        });
    }, []);

    // Update query
    const setQuery = useCallback((query) => {
        setState(prev => ({ ...prev, query }));
    }, []);

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

    // Update response for a model
    const updateResponse = useCallback((modelId, text) => {
        setState(prev => {
            const currentRoundIndex = prev.currentRound - 1;
            const newRounds = [...prev.rounds];
            const currentRound = { ...newRounds[currentRoundIndex] };
            const responses = { ...currentRound.responses };

            responses[modelId] = {
                text,
                status: parseStatus(text)
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
                        response: ''
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

    // Update synthesis response
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
        setState(createInitialState());
    }, []);

    // Load from history
    const loadFromHistory = useCallback((deliberation) => {
        setState(deliberation);
    }, []);

    // Delete from history
    const deleteFromHistory = useCallback((id) => {
        setHistory(h => h.filter(d => d.id !== id));
    }, []);

    // Generate prompt for current round
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

        return generateRoundNPrompt(state.query, modelId, ownResponse, othersResponses, state.currentRound);
    }, [state.query, state.currentRound, state.rounds, state.enabledModels]);

    return {
        state,
        history,
        // Actions
        setQuery,
        toggleModel,
        startDeliberation,
        updateResponse,
        nextRound,
        updateSynthesis,
        complete,
        startNew,
        loadFromHistory,
        deleteFromHistory,
        // Helpers
        getPromptForModel,
        getCurrentResponses,
        canProceedToNextRound,
        shouldShowSynthesis
    };
}
