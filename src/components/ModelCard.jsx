import { useState } from 'react';
import { MODEL_NAMES } from '../utils/prompts';

export function ModelCard({ modelId, prompt, response, status, onResponseChange }) {
    const [copied, setCopied] = useState(false);

    const colorVar = `var(--color-${modelId})`;
    const modelName = MODEL_NAMES[modelId];

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
        if (!status) return null;

        const statusConfig = {
            continue: { label: 'CONTINUE', color: 'var(--color-gemini)', bg: 'var(--color-gemini)' },
            satisfied: { label: 'SATISFIED', color: 'var(--color-gpt)', bg: 'var(--color-gpt)' },
            impasse: { label: 'IMPASSE', color: 'var(--color-claude)', bg: 'var(--color-claude)' }
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

            {/* Prompt section */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-text-muted">
                        Copy this prompt to {modelName}:
                    </label>
                    <button
                        onClick={handleCopy}
                        className={`
              px-3 py-1 rounded-lg text-sm font-medium transition-all
              ${copied
                                ? 'bg-gpt text-white'
                                : 'bg-surface-hover text-text hover:bg-border'
                            }
            `}
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

            {/* Response section */}
            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-text-muted">
                        Paste {modelName}'s response:
                    </label>
                    <span className={`text-xs ${response ? 'text-gpt' : 'text-text-muted'}`}>
                        {response ? '✓ Has content' : '○ Empty'}
                    </span>
                </div>
                <textarea
                    value={response}
                    onChange={(e) => onResponseChange(e.target.value)}
                    placeholder={`Paste ${modelName}'s response here...`}
                    className="w-full h-40 px-3 py-2 bg-surface rounded-lg text-sm text-text placeholder:text-text-muted resize-y border border-border focus:border-gemini transition-colors"
                />
            </div>
        </div>
    );
}
