import { useState, useEffect } from 'react';
import { ProgressIndicator } from './ProgressIndicator';
import { MODEL_DISPLAY } from '../utils/models';

export function SynthesisScreen({
    synthesisPrompt,
    synthesisResponse,
    synthesisLoading,
    synthesisError,
    synthesisModel,
    onUpdateSynthesis,
    onComplete,
    onRunAutomatedSynthesis,
    currentRound,
    isAutomated,
    isRunning
}) {
    const [copied, setCopied] = useState(false);
    const [showPrompt, setShowPrompt] = useState(!isAutomated);

    const synthesisDisplay = MODEL_DISPLAY[synthesisModel?.provider] || MODEL_DISPLAY.openai;

    // Auto-run synthesis in automated mode
    useEffect(() => {
        if (isAutomated && !isRunning && !synthesisResponse && !synthesisLoading && !synthesisError) {
            onRunAutomatedSynthesis?.();
        }
    }, [isAutomated, isRunning, synthesisResponse, synthesisLoading, synthesisError, onRunAutomatedSynthesis]);

    // Auto-complete when synthesis is done in automated mode
    useEffect(() => {
        if (isAutomated && synthesisResponse && !isRunning) {
            // If tab is hidden, reduce delay to avoid throttling
            const delay = document.hidden ? 50 : 2000;
            const timer = setTimeout(() => {
                onComplete();
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [isAutomated, synthesisResponse, isRunning, onComplete]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(synthesisPrompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const canComplete = synthesisResponse?.trim().length > 0;

    return (
        <div className="max-w-4xl mx-auto">
            <ProgressIndicator currentRound={currentRound} phase="synthesis" />

            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Synthesis</h2>
                <p className="text-text-muted">
                    Deliberation complete after {currentRound} round{currentRound > 1 ? 's' : ''}
                    {isAutomated && (
                        <span className="ml-2">
                            • Using <span style={{ color: synthesisDisplay.color }}>{synthesisDisplay.shortName}</span>
                        </span>
                    )}
                </p>
            </div>

            {/* Synthesis prompt */}
            <div className="bg-surface-alt rounded-xl border border-border p-6 mb-6">
                {isAutomated ? (
                    <>
                        <button
                            onClick={() => setShowPrompt(!showPrompt)}
                            className="w-full flex items-center justify-between text-sm text-text-muted hover:text-text transition-colors mb-3"
                        >
                            <span>View synthesis prompt</span>
                            <svg className={`w-4 h-4 transition-transform ${showPrompt ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {showPrompt && (
                            <>
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
                                    value={synthesisPrompt}
                                    className="w-full h-48 px-4 py-3 bg-surface rounded-lg text-sm text-text-muted font-mono resize-none border border-border"
                                />
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-text-muted">
                                Copy this synthesis prompt to any model:
                            </label>
                            <button
                                onClick={handleCopy}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${copied ? 'bg-[#10a37f] text-white' : 'bg-surface-hover text-text hover:bg-border'}`}
                            >
                                {copied ? '✓ Copied!' : 'Copy Synthesis Prompt'}
                            </button>
                        </div>
                        <textarea
                            readOnly
                            value={synthesisPrompt}
                            className="w-full h-64 px-4 py-3 bg-surface rounded-lg text-sm text-text-muted font-mono resize-none border border-border"
                        />
                    </>
                )}
            </div>

            {/* Synthesis response */}
            <div className="bg-surface-alt rounded-xl border border-border p-6 mb-8">
                <label className="block text-sm font-medium text-text-muted mb-3">
                    {isAutomated ? 'Synthesis response:' : 'Paste the synthesis response:'}
                </label>

                {synthesisLoading ? (
                    <div className="w-full h-64 flex items-center justify-center bg-surface rounded-lg border border-border">
                        <div className="flex items-center gap-3 text-text-muted">
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Generating synthesis with {synthesisDisplay.shortName}...</span>
                        </div>
                    </div>
                ) : synthesisError ? (
                    <div className="w-full h-64 flex flex-col items-center justify-center bg-red-500/10 rounded-lg border border-red-500/30 text-red-500 p-4">
                        <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-center mb-3">{synthesisError}</span>
                        <button
                            onClick={onRunAutomatedSynthesis}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            Retry Synthesis
                        </button>
                    </div>
                ) : (
                    <textarea
                        value={synthesisResponse || ''}
                        onChange={(e) => onUpdateSynthesis(e.target.value)}
                        placeholder={isAutomated ? 'Synthesis will appear here...' : 'Paste the synthesis response here...'}
                        readOnly={isAutomated && synthesisResponse}
                        className={`w-full h-64 px-4 py-3 bg-surface rounded-lg text-text placeholder:text-text-muted resize-y border border-border transition-colors ${isAutomated && synthesisResponse ? '' : 'focus:border-[#4285f4]'}`}
                    />
                )}
            </div>

            {/* Complete button */}
            <div className="flex justify-center">
                <button
                    onClick={onComplete}
                    disabled={!canComplete || isRunning}
                    className={`
                        px-8 py-3 rounded-xl font-semibold transition-all
                        ${canComplete && !isRunning
                            ? 'bg-gradient-to-r from-[#d4a27f] via-[#10a37f] to-[#4285f4] text-white hover:opacity-90 shadow-lg'
                            : 'bg-surface-alt text-text-muted cursor-not-allowed'
                        }
                    `}
                >
                    {isAutomated && canComplete ? 'Completing...' : 'Complete Deliberation'}
                </button>
            </div>

            {isAutomated && canComplete && (
                <p className="text-center text-text-muted text-sm mt-4">
                    Auto-completing in a moment...
                </p>
            )}
        </div>
    );
}
