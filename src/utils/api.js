// Unified API caller for RationaLLM
// Supports OpenRouter and direct API calls to various providers

import { PROVIDERS, getOpenRouterModelId, getDirectModelId } from './models.js';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

/**
 * Call an LLM with the given prompt
 * @param {Object} config - Model configuration
 * @param {string} config.provider - Endpoint ID (openai, anthropic, openrouter, ollama, etc.)
 * @param {string} config.model - Model ID on that endpoint
 * @param {string} prompt - The prompt to send
 * @param {Object} apiKeys - Object containing API keys (apiKeys.ollama is a server URL)
 * @returns {Promise<string>} The model's response text
 */
export async function callLLM(config, prompt, apiKeys) {
    const { provider, model } = config;

    const apiKey = apiKeys[provider];
    if (!apiKey) {
        throw new Error(provider === 'ollama'
            ? 'No Ollama server URL configured'
            : `No API key configured for ${provider}`);
    }

    switch (provider) {
        case 'ollama':
            return callOllama(model, prompt, apiKey);
        case 'openrouter':
            return callOpenRouter(model, prompt, apiKey);
        case 'openai':
        case 'xai':
        case 'mistral':
        case 'deepseek':
            return callOpenAICompatible(provider, model, prompt, apiKey);
        case 'anthropic':
            return callAnthropic(model, prompt, apiKey);
        case 'google':
            return callGoogle(model, prompt, apiKey);
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}

/**
 * Call OpenRouter API
 */
async function callOpenRouter(model, prompt, apiKey) {
    // model is a full OpenRouter ID from the model picker; fall back to the
    // legacy provider-shorthand mapping for migrated old sessions
    const modelId = model?.includes('/') ? model : getOpenRouterModelId('openai', model);

    const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'RationaLLM'
        },
        body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message || 'OpenRouter API error');
    }

    return data.choices[0]?.message?.content || '';
}

/**
 * Call OpenAI-compatible APIs (OpenAI, xAI, Mistral, DeepSeek)
 */
async function callOpenAICompatible(provider, model, prompt, apiKey) {
    const baseUrl = PROVIDERS[provider].baseUrl;
    const modelId = getDirectModelId(provider, model);

    const response = await fetchWithRetry(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message || `${provider} API error`);
    }

    return data.choices[0]?.message?.content || '';
}

/**
 * Call a local Ollama server via its OpenAI-compatible endpoint.
 * No API key needed; serverUrl is the user-entered base (e.g. http://strixhalo:11434).
 */
async function callOllama(model, prompt, serverUrl) {
    const baseUrl = serverUrl.replace(/\/+$/, '');
    const modelId = getDirectModelId('ollama', model);

    const response = await fetchWithRetry(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message || 'Ollama API error');
    }

    return data.choices[0]?.message?.content || '';
}

/**
 * Call Anthropic API
 */
async function callAnthropic(model, prompt, apiKey) {
    const modelId = getDirectModelId('anthropic', model);

    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: modelId,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message || 'Anthropic API error');
    }

    return data.content[0]?.text || '';
}

/**
 * Call Google Gemini API
 */
async function callGoogle(model, prompt, apiKey) {
    const modelId = getDirectModelId('google', model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 4096
            }
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message || 'Google API error');
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

            // Retry on 429 (rate limit) or 5xx errors
            if ((response.status === 429 || response.status >= 500) && retries > 0) {
                await sleep(RETRY_DELAY);
                return fetchWithRetry(url, options, retries - 1);
            }

            throw new Error(errorMessage);
        }

        return response;
    } catch (error) {
        if (retries > 0 && error.name === 'TypeError') {
            // Network error, retry
            await sleep(RETRY_DELAY);
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call multiple models in parallel
 * @param {Array<Object>} modelConfigs - Array of {id, provider, model} participant configs
 * @param {string} getPrompt - The prompt to send (or function that takes a config)
 * @param {Object} apiKeys - Object containing API keys
 * @param {Function} onProgress - Callback for progress updates (participantId, status)
 * @returns {Promise<Object>} Object mapping participant id to response
 */
export async function callMultipleModels(modelConfigs, getPrompt, apiKeys, onProgress) {
    const results = {};

    const promises = modelConfigs.map(async (config) => {
        const key = config.id || config.provider;
        try {
            onProgress?.(key, 'loading');
            const prompt = typeof getPrompt === 'function' ? getPrompt(config) : getPrompt;
            const response = await callLLM(config, prompt, apiKeys);
            results[key] = { success: true, text: response };
            onProgress?.(key, 'complete');
        } catch (error) {
            results[key] = { success: false, error: error.message };
            onProgress?.(key, 'error', error.message);
        }
    });

    await Promise.all(promises);
    return results;
}
