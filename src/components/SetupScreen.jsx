import { useState, useEffect, useRef } from 'react';
import { MODEL_DISPLAY, PROVIDERS, getAvailableProviders, getParticipantInfo, modelLabel } from '../utils/models';
import { listModels } from '../utils/modelList';

const CUSTOM = '__custom__';
const MAX_MODELS = 5;

export function SetupScreen({
    query,
    enabledModels,
    participants,
    synthesisModel,
    apiKeys,
    settings,
    onQueryChange,
    onToggleModel,
    onAddParticipant,
    onSetSynthesisModel,
    onSetApiKeys,
    onSetSettings,
    onStart,
    canAutomate
}) {
    const availableProviders = getAvailableProviders(apiKeys);

    // Auto-expand if automated mode is on and we have no keys
    const hasAnyApiKey = Object.values(apiKeys || {}).some(k => k?.trim());
    const shouldExpandApiKeys = settings.isAutomated && !hasAnyApiKey;

    const [showApiKeys, setShowApiKeys] = useState(shouldExpandApiKeys);
    const canStart = query.trim().length > 0 && enabledModels.length > 0;
    const atMax = enabledModels.length >= MAX_MODELS;

    // Live model lists per endpoint: { provider: { error?, models? } }
    // (a selected provider with no entry yet means the fetch is in flight)
    const [lists, setLists] = useState({});
    const inflight = useRef(new Set());

    // --- Add-model picker state (automated mode) ---
    const [pickerProvider, setPickerProvider] = useState('');
    const [pickerModel, setPickerModel] = useState('');
    const [customModel, setCustomModel] = useState('');

    // Keep the picker pointed at a usable endpoint (derived, not synced state)
    const effectiveProvider = availableProviders.includes(pickerProvider)
        ? pickerProvider
        : (availableProviders[0] || '');

    const synthesisProvider = availableProviders.includes(synthesisModel?.provider)
        ? synthesisModel.provider
        : null;

    // Fetch model lists for whichever endpoints the pickers point at.
    // State updates happen only in promise callbacks; a ref dedupes fetches.
    useEffect(() => {
        if (!settings.isAutomated) return;
        [effectiveProvider, synthesisProvider].filter(Boolean).forEach(p => {
            if (lists[p] || inflight.current.has(p)) return;
            inflight.current.add(p);
            listModels(p, apiKeys)
                .then(models => setLists(prev => ({ ...prev, [p]: { models } })))
                .catch(err => setLists(prev => ({ ...prev, [p]: { error: err.message } })))
                .finally(() => inflight.current.delete(p));
        });
    }, [settings.isAutomated, effectiveProvider, synthesisProvider, lists, apiKeys]);

    const pickerList = lists[effectiveProvider];
    const synthesisList = synthesisProvider ? lists[synthesisProvider] : null;

    const handleAdd = () => {
        const model = pickerModel === CUSTOM ? customModel.trim() : pickerModel;
        if (!effectiveProvider || !model) return;
        onAddParticipant(effectiveProvider, model);
        setPickerModel('');
        setCustomModel('');
    };

    const selectClass = "px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-[#4285f4] transition-colors";

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

            {/* API Keys Section — only relevant in automated mode */}
            {settings.isAutomated && (
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
                                OpenRouter Key <span className="text-text-muted">(ONE key accesses 400+ models)</span>
                            </label>
                            <input
                                type="password"
                                value={apiKeys.openrouter || ''}
                                onChange={(e) => onSetApiKeys({ openrouter: e.target.value })}
                                placeholder="sk-or-v1-..."
                                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-[#4285f4] transition-colors"
                            />
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-3 text-text-muted text-sm">
                            <div className="flex-1 border-t border-border" />
                            <span>or use direct API keys</span>
                            <div className="flex-1 border-t border-border" />
                        </div>

                        {/* Direct API Keys */}
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(PROVIDERS).filter(([id]) => id !== 'openrouter' && id !== 'ollama').map(([id, provider]) => (
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

                        {/* Local server — Ollama, vLLM, LM Studio, etc. */}
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1">
                                Local Server URL <span className="opacity-70">(Ollama, vLLM, LM Studio — no key needed)</span>
                            </label>
                            <input
                                type="text"
                                value={apiKeys.ollama || ''}
                                onChange={(e) => onSetApiKeys({ ollama: e.target.value })}
                                placeholder="http://localhost:11434"
                                className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-sm focus:border-[#4285f4] transition-colors"
                            />
                            {apiKeys.ollama && (
                                <label className="flex items-center gap-2 mt-2 text-xs text-text-muted">
                                    <input
                                        type="checkbox"
                                        checked={settings.serialLocal !== false}
                                        onChange={(e) => onSetSettings({ serialLocal: e.target.checked })}
                                        className="rounded"
                                    />
                                    Run local models one at a time (avoids model-swap thrashing; uncheck if your server can hold several models in memory)
                                </label>
                            )}
                        </div>
                    </div>
                )}
            </div>
            )}

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

            {/* Deliberation models */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-text-muted mb-3">
                    Deliberation models {enabledModels.length > 0 && `(${enabledModels.length}/${MAX_MODELS})`}
                </label>

                {/* Selected participants */}
                {enabledModels.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {enabledModels.map(id => {
                            const info = getParticipantInfo(participants, id);
                            const chipLabel = settings.isAutomated && !info.model
                                ? `${info.label} default`
                                : info.label;
                            return (
                                <span
                                    key={id}
                                    className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg text-sm font-medium text-white shadow"
                                    style={{ backgroundColor: info.color }}
                                    title={info.model ? `${PROVIDERS[info.provider]?.name || info.provider}: ${info.model}` : chipLabel}
                                >
                                    {chipLabel}
                                    <button
                                        onClick={() => onToggleModel(id)}
                                        className="hover:bg-white/25 rounded px-1 leading-none"
                                        title="Remove"
                                    >
                                        ×
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                )}

                {settings.isAutomated ? (
                    /* Add-model picker: endpoint + live-fetched model list */
                    availableProviders.length === 0 ? (
                        <p className="text-sm text-text-muted">
                            Add an API key or local server URL above to pick models.
                        </p>
                    ) : (
                        <div className="p-3 bg-surface-alt rounded-xl border border-border">
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={effectiveProvider}
                                    onChange={(e) => { setPickerProvider(e.target.value); setPickerModel(''); }}
                                    className={selectClass}
                                >
                                    {availableProviders.map(p => (
                                        <option key={p} value={p}>{PROVIDERS[p]?.name || p}</option>
                                    ))}
                                </select>

                                <select
                                    value={pickerModel}
                                    onChange={(e) => setPickerModel(e.target.value)}
                                    disabled={!pickerList}
                                    className={`${selectClass} flex-1 min-w-40`}
                                >
                                    <option value="">
                                        {!pickerList ? 'Loading models…'
                                            : pickerList.error ? 'Model list unavailable'
                                                : 'Select a model…'}
                                    </option>
                                    {(pickerList?.models || []).map(m => (
                                        <option key={m.id} value={m.id}>{m.label}</option>
                                    ))}
                                    <option value={CUSTOM}>Custom model ID…</option>
                                </select>

                                {pickerModel === CUSTOM && (
                                    <input
                                        type="text"
                                        value={customModel}
                                        onChange={(e) => setCustomModel(e.target.value)}
                                        placeholder="model-id"
                                        className={`${selectClass} flex-1 min-w-32`}
                                    />
                                )}

                                <button
                                    onClick={handleAdd}
                                    disabled={atMax || !effectiveProvider || !pickerModel || (pickerModel === CUSTOM && !customModel.trim())}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                                        ${!atMax && pickerModel && (pickerModel !== CUSTOM || customModel.trim())
                                            ? 'bg-[#4285f4] text-white hover:opacity-90'
                                            : 'bg-surface-hover text-text-muted cursor-not-allowed'}`}
                                >
                                    + Add
                                </button>
                            </div>
                            {pickerList?.error && (
                                <p className="text-xs text-amber-500 mt-2">
                                    Couldn't fetch models ({pickerList.error}) — use "Custom model ID…" instead.
                                </p>
                            )}
                            {atMax && (
                                <p className="text-xs text-amber-500 mt-2">Max {MAX_MODELS} models — remove one to add another.</p>
                            )}
                        </div>
                    )
                ) : (
                    /* Manual mode: brand quick-picks, copy-paste to their web UIs */
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(MODEL_DISPLAY).map(provider => {
                            const isEnabled = enabledModels.includes(provider);
                            if (isEnabled) return null;
                            const display = MODEL_DISPLAY[provider];
                            return (
                                <button
                                    key={provider}
                                    onClick={() => onToggleModel(provider)}
                                    disabled={atMax}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all
                                        ${!atMax
                                            ? 'bg-surface-alt text-text-muted border border-border hover:border-text-muted'
                                            : 'bg-surface-alt text-text-muted/50 border border-border cursor-not-allowed'}`}
                                    title={atMax ? `Max ${MAX_MODELS} models` : `Add ${display.shortName}`}
                                >
                                    + {display.shortName}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Synthesis model — only meaningful when the app runs the synthesis call */}
            {settings.isAutomated && availableProviders.length > 0 && (
                <div className="mb-8">
                    <label className="block text-sm font-medium text-text-muted mb-2">
                        Synthesis model
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={synthesisProvider || ''}
                            onChange={(e) => onSetSynthesisModel(e.target.value, null, null)}
                            className={selectClass}
                        >
                            {!synthesisProvider && <option value="">Select endpoint…</option>}
                            {availableProviders.map(p => (
                                <option key={p} value={p}>{PROVIDERS[p]?.name || p}</option>
                            ))}
                        </select>
                        <select
                            value={synthesisModel?.model || ''}
                            onChange={(e) => {
                                const m = e.target.value || null;
                                onSetSynthesisModel(synthesisModel.provider, m, m ? modelLabel(m) : null);
                            }}
                            disabled={!synthesisProvider || !synthesisList}
                            className={`${selectClass} flex-1 min-w-40`}
                        >
                            <option value="">
                                {synthesisProvider && !synthesisList ? 'Loading models…'
                                    : synthesisList?.error ? 'Model list unavailable — provider default'
                                        : 'Provider default'}
                            </option>
                            {(synthesisList?.models || []).map(m => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Warning if automation not available */}
            {settings.isAutomated && !canAutomate() && enabledModels.length > 0 && (
                <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-500">
                    Some selected models are missing an API key for their endpoint — add keys above or remove them
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
                            <li>1. Configure your API keys or local server above</li>
                            <li>2. Pick 2-5 models — several from one endpoint is fine</li>
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
