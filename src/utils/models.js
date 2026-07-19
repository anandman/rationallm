// Model and provider definitions for RationaLLM
// Supports OpenRouter (unified) and direct API calls

export const PROVIDERS = {
    openrouter: {
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        keyPrefix: 'sk-or-',
        description: 'Unified access to 400+ models'
    },
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        keyPrefix: 'sk-',
        description: 'GPT-4o, GPT-4.1, o1, o3, etc.'
    },
    anthropic: {
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        keyPrefix: 'sk-ant-',
        description: 'Claude 4, Claude 3.5, etc.'
    },
    google: {
        name: 'Google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        keyPrefix: 'AIza',
        description: 'Gemini 2.5, Gemini 2.0, etc.'
    },
    xai: {
        name: 'xAI',
        baseUrl: 'https://api.x.ai/v1',
        keyPrefix: 'xai-',
        description: 'Grok 2, Grok 3, etc.'
    },
    mistral: {
        name: 'Mistral',
        baseUrl: 'https://api.mistral.ai/v1',
        keyPrefix: '',
        description: 'Mistral Large, Codestral, etc.'
    },
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        keyPrefix: 'sk-',
        description: 'DeepSeek V3, DeepSeek R1, etc.'
    },
    ollama: {
        // baseUrl comes from the user-entered server URL (stored in apiKeys.ollama)
        name: 'Ollama',
        baseUrl: null,
        keyPrefix: 'http',
        description: 'Local models via an Ollama server'
    }
};

// Default models for each provider (user can override with any model ID)
export const DEFAULT_MODELS = {
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-20250514',
    google: 'gemini-2.5-pro',
    xai: 'grok-2',
    mistral: 'mistral-large-latest',
    deepseek: 'deepseek-chat',
    // no ollama entry: its default resolves to the server's first installed
    // model at call time (see callLLM)
    // OpenRouter uses provider/model format
    openrouter: {
        openai: 'openai/gpt-4o',
        anthropic: 'anthropic/claude-sonnet-4-20250514',
        google: 'google/gemini-2.5-pro-preview-06-05',
        xai: 'x-ai/grok-2',
        mistral: 'mistralai/mistral-large',
        deepseek: 'deepseek/deepseek-chat',
        qwen: 'qwen/qwen-2.5-72b-instruct',
        mimo: 'xiaomi/mimo-vl-7b-rl'
    }
};

// Display names and colors for UI
export const MODEL_DISPLAY = {
    openai: { name: 'OpenAI', color: '#10a37f', shortName: 'GPT' },
    anthropic: { name: 'Anthropic', color: '#d4a27f', shortName: 'Claude' },
    google: { name: 'Google', color: '#4285f4', shortName: 'Gemini' },
    xai: { name: 'xAI', color: '#1da1f2', shortName: 'Grok' },
    mistral: { name: 'Mistral', color: '#ff7000', shortName: 'Mistral' },
    deepseek: { name: 'DeepSeek', color: '#0066ff', shortName: 'DeepSeek' },
    ollama: { name: 'Ollama', color: '#64748b', shortName: 'Ollama' }
};

// Brand colors for well-known model families, used when a generic endpoint
// (OpenRouter, Ollama) serves a recognizable model
const BRAND_COLORS = [
    [/claude/i, '#d4a27f'],
    [/gpt|^o\d|openai|codex/i, '#10a37f'],
    [/gemini|gemma/i, '#4285f4'],
    [/grok/i, '#1da1f2'],
    [/mistral|mixtral|codestral|magistral|devstral/i, '#ff7000'],
    [/deepseek/i, '#0066ff'],
    [/llama/i, '#0668e1'],
    [/qwen/i, '#7c3aed'],
    [/kimi|moonshot/i, '#16a34a'],
    [/nemotron|nvidia/i, '#76b900']
];

// Short human label for a model ID: strip vendor prefix and :latest tag
export function modelLabel(modelId) {
    if (!modelId) return '';
    return modelId.split('/').pop().replace(/:latest$/, '');
}

function colorForModel(provider, modelId) {
    for (const [pattern, color] of BRAND_COLORS) {
        if (pattern.test(modelLabel(modelId))) return color;
    }
    return MODEL_DISPLAY[provider]?.color || '#64748b';
}

/**
 * A participant is one model taking part in a deliberation. Several
 * participants may share a provider (e.g. three OpenRouter models).
 * id doubles as the key for responses/enabledModels. A participant with no
 * model (manual mode, or migrated old state) keeps the bare provider as id
 * so old sessions' response keys still match.
 */
export function makeParticipant(provider, model = null) {
    const display = MODEL_DISPLAY[provider];
    if (!model) {
        return {
            id: provider,
            provider,
            model: null,
            label: display?.shortName || provider,
            color: display?.color || '#64748b'
        };
    }
    return {
        id: `${provider}:${model}`,
        provider,
        model,
        label: modelLabel(model),
        color: colorForModel(provider, model)
    };
}

/**
 * Look up a participant by id, tolerating old state shapes where ids were
 * bare provider names and no participants map existed.
 */
export function getParticipantInfo(participants, id) {
    if (participants?.[id]) return participants[id];
    if (id?.includes(':')) {
        const [provider, ...rest] = id.split(':');
        return makeParticipant(provider, rest.join(':'));
    }
    return makeParticipant(id);
}

// Get OpenRouter model ID for a provider
export function getOpenRouterModelId(provider, customModel = null) {
    if (customModel) {
        // If it already has a slash, assume it's a full OpenRouter ID
        if (customModel.includes('/')) return customModel;
        // Otherwise, construct it from provider
        const providerMap = {
            openai: 'openai',
            anthropic: 'anthropic',
            google: 'google',
            xai: 'x-ai',
            mistral: 'mistralai',
            deepseek: 'deepseek',
            qwen: 'qwen',
            mimo: 'xiaomi'
        };
        return `${providerMap[provider] || provider}/${customModel}`;
    }
    return DEFAULT_MODELS.openrouter[provider] || DEFAULT_MODELS.openrouter.openai;
}

// Get direct API model ID
export function getDirectModelId(provider, customModel = null) {
    return customModel || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai;
}

// Create a model configuration object
export function createModelConfig(provider, customModel = null) {
    return {
        provider,
        model: customModel || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai,
        display: MODEL_DISPLAY[provider] || MODEL_DISPLAY.openai
    };
}

// Validate that we have the required API key for a provider
// A provider is usable when its key (or, for Ollama, its server URL) is set.
// OpenRouter is an endpoint of its own — no implicit routing for others.
export function hasApiKeyForProvider(apiKeys, provider) {
    return !!apiKeys?.[provider];
}

// All endpoints with a key/URL configured (openrouter included as its own)
export function getAvailableProviders(apiKeys) {
    return Object.keys(PROVIDERS).filter(p => !!apiKeys?.[p]);
}
