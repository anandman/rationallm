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
    deepseek: { name: 'DeepSeek', color: '#0066ff', shortName: 'DeepSeek' }
};

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
export function hasApiKeyForProvider(apiKeys, provider, useOpenRouter = false) {
    if (useOpenRouter && apiKeys.openrouter) {
        return true;
    }
    return !!apiKeys[provider];
}

// Get all available providers that have API keys configured
export function getAvailableProviders(apiKeys) {
    const hasOpenRouter = !!apiKeys.openrouter;
    const directProviders = Object.keys(PROVIDERS)
        .filter(p => p !== 'openrouter' && apiKeys[p]);

    if (hasOpenRouter) {
        // OpenRouter gives access to all providers
        return Object.keys(MODEL_DISPLAY);
    }
    return directProviders;
}
