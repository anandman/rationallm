// Unified API caller for RationaLLM
// Supports OpenRouter and direct API calls to various providers

import { PROVIDERS, getOpenRouterModelId, getDirectModelId } from './models.js';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

/**
 * Call an LLM with the given prompt
 * @param {Object} config - Model configuration
 * @param {string} config.provider - Provider ID (openai, anthropic, etc.)
 * @param {string} config.model - Model ID (can be custom)
 * @param {string} prompt - The prompt to send
 * @param {Object} apiKeys - Object containing API keys
 * @param {boolean} useOpenRouter - Whether to use OpenRouter
 * @returns {Promise<string>} The model's response text
 */
export async function callLLM(config, prompt, apiKeys, useOpenRouter = false) {
    const { provider, model } = config;

    // Determine which API to use
    if (useOpenRouter && apiKeys.openrouter) {
        return callOpenRouter(provider, model, prompt, apiKeys.openrouter);
    }

    // Direct API calls
    const apiKey = apiKeys[provider];
    if (!apiKey) {
        throw new Error(`No API key configured for ${provider}`);
    }

    switch (provider) {
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
async function callOpenRouter(provider, model, prompt, apiKey) {
    const modelId = getOpenRouterModelId(provider, model);

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
 * @param {Array<Object>} modelConfigs - Array of model configurations
 * @param {string} prompt - The prompt to send (or function that takes modelConfig)
 * @param {Object} apiKeys - Object containing API keys
 * @param {boolean} useOpenRouter - Whether to use OpenRouter
 * @param {Function} onProgress - Callback for progress updates (modelId, status)
 * @returns {Promise<Object>} Object mapping provider to response
 */
export async function callMultipleModels(modelConfigs, getPrompt, apiKeys, useOpenRouter, onProgress) {
    const results = {};

    const promises = modelConfigs.map(async (config) => {
        const { provider } = config;
        try {
            onProgress?.(provider, 'loading');
            const prompt = typeof getPrompt === 'function' ? getPrompt(config) : getPrompt;
            const response = await callLLM(config, prompt, apiKeys, useOpenRouter);
            results[provider] = { success: true, text: response };
            onProgress?.(provider, 'complete');
        } catch (error) {
            results[provider] = { success: false, error: error.message };
            onProgress?.(provider, 'error', error.message);
        }
    });

    await Promise.all(promises);
    return results;
}
