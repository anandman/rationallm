import { useState } from 'react';
import { ProgressIndicator } from './ProgressIndicator';
import { MODEL_NAMES, exportAsMarkdown } from '../utils/prompts';

export function FinalView({ deliberation, onStartNew }) {
    const [copied, setCopied] = useState(false);
    const [expandedRounds, setExpandedRounds] = useState({});

    const toggleRound = (roundNum) => {
        setExpandedRounds(prev => ({
            ...prev,
            [roundNum]: !prev[roundNum]
        }));
    };

    const handleCopyMarkdown = async () => {
        try {
            const markdown = exportAsMarkdown(deliberation);
            await navigator.clipboard.writeText(markdown);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <ProgressIndicator
                currentRound={deliberation.currentRound}
                phase="complete"
            />

            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-claude via-gpt to-gemini bg-clip-text text-transparent">
                    Deliberation Complete
                </h2>
                <p className="text-text-muted">
                    {deliberation.currentRound} round{deliberation.currentRound > 1 ? 's' : ''} • {deliberation.enabledModels.length} models
                </p>
            </div>

            {/* Original query */}
            <div className="bg-surface-alt rounded-xl border border-border p-6 mb-6">
                <h3 className="font-semibold mb-2 text-text-muted">Original Query</h3>
                <p className="text-text">{deliberation.query}</p>
            </div>

            {/* Rounds (collapsible) */}
            <div className="space-y-4 mb-6">
                {deliberation.rounds.map((round, index) => {
                    const isExpanded = expandedRounds[round.number];

                    return (
                        <div
                            key={round.number}
                            className="bg-surface-alt rounded-xl border border-border overflow-hidden"
                        >
                            <button
                                onClick={() => toggleRound(round.number)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors"
                            >
                                <span className="font-semibold">Round {round.number}</span>
                                <span className="text-text-muted">
                                    {isExpanded ? '▲' : '▼'}
                                </span>
                            </button>

                            {isExpanded && (
                                <div className="px-6 pb-6 space-y-4 border-t border-border pt-4">
                                    {deliberation.enabledModels.map(modelId => {
                                        const response = round.responses[modelId];
                                        if (!response?.text) return null;

                                        return (
                                            <div key={modelId}>
                                                <h4
                                                    className="font-medium mb-2"
                                                    style={{ color: `var(--color-${modelId})` }}
                                                >
                                                    {MODEL_NAMES[modelId]}
                                                    {response.status && (
                                                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-surface text-text-muted">
                                                            {response.status.toUpperCase()}
                                                        </span>
                                                    )}
                                                </h4>
                                                <p className="text-sm text-text-muted whitespace-pre-wrap">
                                                    {response.text}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Synthesis */}
            {deliberation.synthesis?.response && (
                <div className="bg-surface-alt rounded-xl border-2 border-gpt p-6 mb-8">
                    <h3 className="font-semibold mb-3 text-gpt">Final Synthesis</h3>
                    <p className="text-text whitespace-pre-wrap">
                        {deliberation.synthesis.response}
                    </p>
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-4 justify-center">
                <button
                    onClick={handleCopyMarkdown}
                    className={`
            px-6 py-3 rounded-xl font-medium transition-all
            ${copied
                            ? 'bg-gpt text-white'
                            : 'bg-surface-alt text-text border border-border hover:border-text-muted'
                        }
          `}
                >
                    {copied ? '✓ Copied!' : 'Copy as Markdown'}
                </button>

                <button
                    onClick={onStartNew}
                    className="px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-claude via-gpt to-gemini text-white hover:opacity-90 shadow-lg"
                >
                    Start New Deliberation
                </button>
            </div>
        </div>
    );
}
