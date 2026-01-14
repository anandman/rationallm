import { useState } from 'react';
import { ProgressIndicator } from './ProgressIndicator';

export function SynthesisScreen({
    synthesisPrompt,
    synthesisResponse,
    onUpdateSynthesis,
    onComplete,
    currentRound
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(synthesisPrompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const canComplete = synthesisResponse.trim().length > 0;

    return (
        <div className="max-w-4xl mx-auto">
            <ProgressIndicator currentRound={currentRound} phase="synthesis" />

            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Synthesis</h2>
                <p className="text-text-muted">
                    Deliberation complete after {currentRound} round{currentRound > 1 ? 's' : ''}
                </p>
            </div>

            {/* Synthesis prompt */}
            <div className="bg-surface-alt rounded-xl border border-border p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-text-muted">
                        Copy this synthesis prompt to any model:
                    </label>
                    <button
                        onClick={handleCopy}
                        className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${copied
                                ? 'bg-gpt text-white'
                                : 'bg-surface-hover text-text hover:bg-border'
                            }
            `}
                    >
                        {copied ? '✓ Copied!' : 'Copy Synthesis Prompt'}
                    </button>
                </div>
                <textarea
                    readOnly
                    value={synthesisPrompt}
                    className="w-full h-64 px-4 py-3 bg-surface rounded-lg text-sm text-text-muted font-mono resize-none border border-border"
                />
            </div>

            {/* Synthesis response */}
            <div className="bg-surface-alt rounded-xl border border-border p-6 mb-8">
                <label className="block text-sm font-medium text-text-muted mb-3">
                    Paste the synthesis response:
                </label>
                <textarea
                    value={synthesisResponse}
                    onChange={(e) => onUpdateSynthesis(e.target.value)}
                    placeholder="Paste the synthesis response here..."
                    className="w-full h-64 px-4 py-3 bg-surface rounded-lg text-text placeholder:text-text-muted resize-y border border-border focus:border-gpt transition-colors"
                />
            </div>

            {/* Complete button */}
            <div className="flex justify-center">
                <button
                    onClick={onComplete}
                    disabled={!canComplete}
                    className={`
            px-8 py-3 rounded-xl font-semibold transition-all
            ${canComplete
                            ? 'bg-gradient-to-r from-claude via-gpt to-gemini text-white hover:opacity-90 shadow-lg'
                            : 'bg-surface-alt text-text-muted cursor-not-allowed'
                        }
          `}
                >
                    Complete Deliberation
                </button>
            </div>
        </div>
    );
}
