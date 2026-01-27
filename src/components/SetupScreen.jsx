import { useState } from 'react';
import { MODEL_DISPLAY, PROVIDERS, getAvailableProviders } from '../utils/models';

export function SetupScreen({
    query,
    enabledModels,
    modelConfigs,
    synthesisModel,
    apiKeys,
    settings,
    onQueryChange,
    onToggleModel,
    onSetModelConfig,
    onSetSynthesisModel,
    onSetApiKeys,
    onSetSettings,
    onStart,
    canAutomate
}) {
    const allProviders = Object.keys(MODEL_DISPLAY);
    const availableProviders = getAvailableProviders(apiKeys);

    // Auto-expand if automated mode is on and we have no keys
    const hasAnyApiKey = Object.values(apiKeys || {}).some(k => k?.trim());
    const shouldExpandApiKeys = settings.isAutomated && !hasAnyApiKey;

    const [showApiKeys, setShowApiKeys] = useState(shouldExpandApiKeys);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const canStart = query.trim().length > 0 && enabledModels.length > 0;

    return (
        <div className="max-w-3xl mx-auto">
            {/* Hero section */}
            <div className="text-center mb-12">
                <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-[#d4a27f] via-[#10a37f] to-[#4285f4] bg-clip-text text-transparent">
                    RationaLLM
                </h1>
                <p className="text-text-muted text-lg">
                    Multi-model deliberation & rationalization
                </p>
            </div>

            {/* API Keys Section */}
            <div className="mb-8">
                <button
                    onClick={() => setShowApiKeys(!showApiKeys)}
                    className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text transition-colors mb-3"
                >
                    <svg className={`w-4 h-4 transition-transform ${showApiKeys ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    API Configuration {hasAnyApiKey ? '✓' : '(required for automation)'}
                </button>

                {showApiKeys && (
                    <div className="p-4 bg-surface-alt rounded-xl border border-border space-y-4">
                        {/* OpenRouter (recommended) */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                OpenRouter Key <span className="text-text-muted">(ONE key accesses ALL models)</span>
                            </label>
                            <input
                                type="password"
                                value={apiKeys.openrouter || ''}
                                onChange={(e) => onSetApiKeys({ openrouter: e.target.value })}
                                placeholder="sk-or-v1-..."
                                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-[#4285f4] transition-colors"
                            />
                            {apiKeys.openrouter && (
                                <label className="flex items-center gap-2 mt-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={settings.useOpenRouter}
                                        onChange={(e) => onSetSettings({ useOpenRouter: e.target.checked })}
                                        className="rounded"
                                    />
                                    Use OpenRouter for all calls
                                </label>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-3 text-text-muted text-sm">
                            <div className="flex-1 border-t border-border" />
                            <span>or use direct API keys</span>
                            <div className="flex-1 border-t border-border" />
                        </div>

                        {/* Direct API Keys */}
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(PROVIDERS).filter(([id]) => id !== 'openrouter').map(([id, provider]) => (
                                <div key={id}>
                                    <label className="block text-xs font-medium text-text-muted mb-1">
                                        {provider.name}
                                    </label>
                                    <input
                                        type="password"
                                        value={apiKeys[id] || ''}
                                        onChange={(e) => onSetApiKeys({ [id]: e.target.value })}
                                        placeholder={provider.keyPrefix ? `${provider.keyPrefix}...` : 'API key'}
                                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-sm focus:border-[#4285f4] transition-colors"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Query input */}
            <div className="mb-8">
                <label className="block text-sm font-medium text-text-muted mb-2">
                    Enter your query
                </label>
                <textarea
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="What would you like the AI models to deliberate on?"
                    className="w-full h-40 px-4 py-3 bg-surface-alt border border-border rounded-xl text-text placeholder:text-text-muted focus:border-[#4285f4] transition-colors"
                />
            </div>

            {/* Model selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-text-muted mb-3">
                    Select deliberation models
                </label>
                <div className="flex flex-wrap gap-2">
                    {allProviders.map(provider => {
                        const isEnabled = enabledModels.includes(provider);
                        const display = MODEL_DISPLAY[provider];
                        const hasKey = availableProviders.includes(provider);

                        const isLocked = settings.isAutomated && !hasKey && !isEnabled;
                        const isMaxed = enabledModels.length >= 5 && !isEnabled;
                        const isDisabled = isLocked || isMaxed;

                        return (
                            <button
                                key={provider}
                                onClick={() => onToggleModel(provider)}
                                disabled={isDisabled}
                                className={`
                                    px-4 py-2 rounded-lg font-medium text-sm transition-all
                                    ${isEnabled
                                        ? 'text-white shadow-lg'
                                        : !isDisabled
                                            ? 'bg-surface-alt text-text-muted border border-border hover:border-text-muted'
                                            : 'bg-surface-alt text-text-muted/50 border border-border cursor-not-allowed'
                                    }
                                `}
                                style={isEnabled ? { backgroundColor: display.color } : {}}
                                title={
                                    isLocked ? 'Add API key to enable (or switch to Manual Mode)' :
                                        isMaxed ? 'Max 5 models allowed' : ''
                                }
                            >
                                {display.shortName}
                            </button>
                        );
                    })}
                </div>
                {enabledModels.length > 5 && (
                    <p className="text-xs text-amber-500 mt-2">Tip: 2-5 models recommended for best deliberation</p>
                )}
            </div>

            {/* Advanced: Custom model IDs */}
            {enabledModels.length > 0 && (
                <div className="mb-6">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-xs font-medium text-text-muted hover:text-text transition-colors"
                    >
                        <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Custom model IDs
                    </button>

                    {showAdvanced && (
                        <div className="mt-3 p-3 bg-surface-alt rounded-lg border border-border space-y-2">
                            {enabledModels.map(provider => (
                                <div key={provider} className="flex items-center gap-2">
                                    <span className="text-xs font-medium w-20" style={{ color: MODEL_DISPLAY[provider].color }}>
                                        {MODEL_DISPLAY[provider].shortName}
                                    </span>
                                    <input
                                        type="text"
                                        value={modelConfigs[provider]?.model || ''}
                                        onChange={(e) => onSetModelConfig(provider, e.target.value || null)}
                                        placeholder={`Default model`}
                                        className="flex-1 px-2 py-1 bg-surface border border-border rounded text-xs focus:border-[#4285f4] transition-colors"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Synthesis model */}
            <div className="mb-8">
                <label className="block text-sm font-medium text-text-muted mb-2">
                    Synthesis model
                </label>
                <select
                    value={synthesisModel.provider}
                    onChange={(e) => onSetSynthesisModel(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-border rounded-lg text-sm focus:border-[#4285f4] transition-colors"
                >
                    {availableProviders.map(provider => (
                        <option key={provider} value={provider}>
                            {MODEL_DISPLAY[provider].name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Mode toggle */}
            <div className="mb-8 flex items-center justify-between p-4 bg-surface-alt rounded-xl border border-border">
                <div>
                    <div className="font-medium">
                        {settings.isAutomated ? 'Automated Mode' : 'Manual Mode'}
                    </div>
                    <div className="text-sm text-text-muted">
                        {settings.isAutomated
                            ? 'API calls run automatically'
                            : 'Copy prompts and paste responses'
                        }
                    </div>
                </div>
                <button
                    onClick={() => onSetSettings({ isAutomated: !settings.isAutomated })}
                    className={`
                        relative w-14 h-7 rounded-full transition-colors
                        ${settings.isAutomated ? 'bg-[#10a37f]' : 'bg-surface-hover'}
                    `}
                >
                    <div className={`
                        absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform
                        ${settings.isAutomated ? 'translate-x-8' : 'translate-x-1'}
                    `} />
                </button>
            </div>

            {/* Warning if automation not available */}
            {settings.isAutomated && !canAutomate() && (
                <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-500">
                    Add API keys for all selected models, or enable OpenRouter
                </div>
            )}

            {/* Start button */}
            <button
                onClick={onStart}
                disabled={!canStart || (settings.isAutomated && !canAutomate())}
                className={`
                    w-full py-4 rounded-xl font-semibold text-lg transition-all
                    ${canStart && (!settings.isAutomated || canAutomate())
                        ? 'bg-gradient-to-r from-[#d4a27f] via-[#10a37f] to-[#4285f4] text-white hover:opacity-90 shadow-lg'
                        : 'bg-surface-alt text-text-muted cursor-not-allowed'
                    }
                `}
            >
                Start Rationalization
            </button>

            {/* Info */}
            <div className="mt-12 p-6 bg-surface-alt rounded-xl border border-border">
                <h3 className="font-semibold mb-3">How it works</h3>
                <ol className="text-text-muted space-y-2 text-sm">
                    {settings.isAutomated ? (
                        <>
                            <li>1. Configure your API keys above</li>
                            <li>2. Select 2-5 models for deliberation</li>
                            <li>3. Click Start - models automatically discuss until consensus</li>
                            <li>4. The synthesis model generates a unified answer</li>
                        </>
                    ) : (
                        <>
                            <li>1. Copy each model's prompt to their respective chat interfaces</li>
                            <li>2. Paste their responses back here</li>
                            <li>3. Models see each other's perspectives and refine their answers</li>
                            <li>4. After consensus (or max 5 rounds), generate a synthesis</li>
                        </>
                    )}
                </ol>
                {!settings.isAutomated && (
                    <p className="mt-4 text-xs text-text-muted">
                        <strong>Why manual mode?</strong> Useful for trying models without API access, testing without using credits, or having full control over each interaction.
                    </p>
                )}
            </div>
        </div>
    );
}
