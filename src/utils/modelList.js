// Live model discovery per endpoint.
// OpenAI-style GET /models covers OpenRouter, Ollama/vLLM/LM Studio, xAI,
// Mistral, DeepSeek, and OpenAI itself; Anthropic and Google have their own
// listing endpoints. Results are cached per provider+credential for the session.

import { PROVIDERS } from './models.js';

const cache = new Map();

// OpenAI returns every model it hosts; hide the ones that can't chat
const OPENAI_NON_CHAT = /embed|whisper|tts|dall-e|moderation|davinci|babbage|audio|realtime|transcribe|image/i;

/**
 * List models available on a provider endpoint.
 * @returns {Promise<Array<{id: string, label: string}>>}
 */
export async function listModels(provider, apiKeys) {
    const credential = apiKeys?.[provider] || '';
    const cacheKey = `${provider}:${credential}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const models = await fetchModels(provider, credential);
    models.sort((a, b) => a.id.localeCompare(b.id));
    cache.set(cacheKey, models);
    return models;
}

async function fetchModels(provider, credential) {
    switch (provider) {
        case 'openrouter':
            return listOpenAIStyle('https://openrouter.ai/api/v1/models', null);
        case 'ollama':
            if (!credential) throw new Error('No Ollama server URL configured');
            return listOpenAIStyle(`${credential.replace(/\/+$/, '')}/v1/models`, null);
        case 'anthropic':
            return listAnthropic(credential);
        case 'google':
            return listGoogle(credential);
        case 'openai': {
            const models = await listOpenAIStyle(`${PROVIDERS.openai.baseUrl}/models`, credential);
            return models.filter(m => !OPENAI_NON_CHAT.test(m.id));
        }
        default:
            return listOpenAIStyle(`${PROVIDERS[provider].baseUrl}/models`, credential);
    }
}

async function listOpenAIStyle(url, apiKey) {
    const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Model list failed: HTTP ${response.status}`);
    const data = await response.json();
    return (data.data || []).map(m => ({ id: m.id, label: m.name || m.id }));
}

async function listAnthropic(apiKey) {
    const response = await fetch('https://api.anthropic.com/v1/models?limit=100', {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        }
    });
    if (!response.ok) throw new Error(`Model list failed: HTTP ${response.status}`);
    const data = await response.json();
    return (data.data || []).map(m => ({ id: m.id, label: m.display_name || m.id }));
}

async function listGoogle(apiKey) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${apiKey}`
    );
    if (!response.ok) throw new Error(`Model list failed: HTTP ${response.status}`);
    const data = await response.json();
    return (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }));
}
