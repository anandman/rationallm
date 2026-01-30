import { useState } from 'react';
import { MODEL_DISPLAY } from '../utils/models';
import { MarkdownRenderer } from './MarkdownRenderer';

export function ModelCard({ modelId, prompt, response, status, loading, error, onResponseChange, isAutomated, onDisable }) {
    const [copied, setCopied] = useState(false);
    const [showPrompt, setShowPrompt] = useState(!isAutomated);
    const [viewMode, setViewMode] = useState((isAutomated || response) ? 'preview' : 'edit');

    const display = MODEL_DISPLAY[modelId] || MODEL_DISPLAY.openai;
    const colorVar = display.color;
    const modelName = display.shortName;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const getStatusBadge = () => {
        if (loading) {
            return (
                <span className="px-2 py-0.5 rounded text-xs font-semibold text-white bg-[#4285f4] animate-pulse">
                    GENERATING...
                </span>
            );
        }

        if (error) {
            return (
                <span className="px-2 py-0.5 rounded text-xs font-semibold text-white bg-red-500" title={error}>
                    ERROR
                </span>
            );
        }

        if (!status) return null;

        const statusConfig = {
            continue: { label: 'CONTINUE', bg: '#4285f4' },
            satisfied: { label: 'SATISFIED', bg: '#10a37f' },
            impasse: { label: 'IMPASSE', bg: '#d4a27f' }
        };

        const config = statusConfig[status];
        if (!config) return null;

        return (
            <span
                className="px-2 py-0.5 rounded text-xs font-semibold text-white"
                style={{ backgroundColor: config.bg }}
            >
                {config.label}
            </span>
        );
    };

    return (
        <div
            className="bg-surface-alt rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg"
            style={{ borderColor: colorVar }}
        >
            {/* Header */}
            <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: `color-mix(in srgb, ${colorVar} 15%, transparent)` }}
            >
                <h3 className="font-semibold" style={{ color: colorVar }}>
                    {modelName}
                </h3>
                {getStatusBadge()}
            </div>

            {/* Prompt section - collapsible in automated mode */}
            {isAutomated ? (
                <div className="border-b border-border">
                    <button
                        onClick={() => setShowPrompt(!showPrompt)}
                        className="w-full px-4 py-2 flex items-center justify-between text-sm text-text-muted hover:bg-surface-hover transition-colors"
                    >
                        <span>View prompt</span>
                        <svg className={`w-4 h-4 transition-transform ${showPrompt ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showPrompt && (
                        <div className="px-4 pb-4">
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={handleCopy}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${copied ? 'bg-[#10a37f] text-white' : 'bg-surface-hover text-text hover:bg-border'}`}
                                >
                                    {copied ? '✓ Copied!' : 'Copy'}
                                </button>
                            </div>
                            <textarea
                                readOnly
                                value={prompt}
                                className="w-full h-32 px-3 py-2 bg-surface rounded-lg text-sm text-text-muted font-mono resize-none border border-border"
                            />
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-text-muted">
                            Copy this prompt to {modelName}:
                        </label>
                        <button
                            onClick={handleCopy}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${copied ? 'bg-[#10a37f] text-white' : 'bg-surface-hover text-text hover:bg-border'}`}
                        >
                            {copied ? '✓ Copied!' : 'Copy'}
                        </button>
                    </div>
                    <textarea
                        readOnly
                        value={prompt}
                        className="w-full h-32 px-3 py-2 bg-surface rounded-lg text-sm text-text-muted font-mono resize-none border border-border"
                    />
                </div>
            )}

            {/* Response section */}
            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-text-muted">
                            {modelName}'s response:
                        </label>
                        {/* View toggle */}
                        <div className="flex bg-surface rounded-lg p-0.5 border border-border">
                            <button
                                onClick={() => setViewMode('preview')}
                                className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${viewMode === 'preview' ? 'bg-surface-alt text-text shadow-sm' : 'text-text-muted hover:text-text'}`}
                            >
                                Preview
                            </button>
                            <button
                                onClick={() => setViewMode('edit')}
                                className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${viewMode === 'edit' ? 'bg-surface-alt text-text shadow-sm' : 'text-text-muted hover:text-text'}`}
                            >
                                {isAutomated ? 'Raw' : 'Edit'}
                            </button>
                        </div>
                    </div>
                    {!loading && (
                        <span className={`text-xs ${response ? 'text-[#10a37f]' : 'text-text-muted'}`}>
                            {response ? '✓ Has content' : '○ Empty'}
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="w-full h-48 flex items-center justify-center bg-surface rounded-lg border border-border">
                        <div className="flex items-center gap-3 text-text-muted">
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Generating response...</span>
                        </div>
                    </div>
                ) : error ? (
                    <div className="w-full h-48 flex flex-col items-center justify-center bg-red-500/10 rounded-lg border border-red-500/30 text-red-500 p-4">
                        <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-center mb-2">{error}</span>
                        {onDisable && (
                            <button
                                onClick={onDisable}
                                className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded transition-colors border border-white/20"
                            >
                                Exclude this model
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="relative">
                        {viewMode === 'preview' ? (
                            <div className="w-full h-48 px-4 py-3 bg-surface rounded-lg border border-border overflow-y-auto">
                                {response ? (
                                    <MarkdownRenderer content={response} />
                                ) : (
                                    <span className="text-sm text-text-muted italic">
                                        {isAutomated ? 'Response will appear here...' : 'No content to preview.'}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <textarea
                                value={response}
                                onChange={(e) => onResponseChange(e.target.value)}
                                placeholder={isAutomated ? 'Response will appear here...' : `Paste ${modelName}'s response here...`}
                                readOnly={isAutomated && response}
                                className={`w-full h-48 px-3 py-2 bg-surface rounded-lg text-sm text-text placeholder:text-text-muted resize-y border border-border transition-colors ${isAutomated && response ? '' : 'focus:border-[#4285f4]'}`}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
