import { useState } from 'react';
import { MODEL_NAMES, MODEL_COLORS } from '../utils/prompts';

export function SetupScreen({ query, enabledModels, onQueryChange, onToggleModel, onStart }) {
    const allModels = ['claude', 'gpt', 'gemini'];
    const canStart = query.trim().length > 0 && enabledModels.length > 0;

    return (
        <div className="max-w-3xl mx-auto">
            {/* Hero section */}
            <div className="text-center mb-12">
                <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-claude via-gpt to-gemini bg-clip-text text-transparent">
                    RationaLLM
                </h1>
                <p className="text-text-muted text-lg">
                    Multi-model deliberation & rationalization
                </p>
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
                    className="w-full h-40 px-4 py-3 bg-surface-alt border border-border rounded-xl text-text placeholder:text-text-muted focus:border-gemini transition-colors"
                />
            </div>

            {/* Model selection */}
            <div className="mb-8">
                <label className="block text-sm font-medium text-text-muted mb-3">
                    Select models to include
                </label>
                <div className="flex flex-wrap gap-3">
                    {allModels.map(modelId => {
                        const isEnabled = enabledModels.includes(modelId);
                        const colorClass = MODEL_COLORS[modelId];

                        return (
                            <button
                                key={modelId}
                                onClick={() => onToggleModel(modelId)}
                                className={`
                  px-5 py-2.5 rounded-lg font-medium transition-all
                  ${isEnabled
                                        ? `bg-${colorClass} text-white shadow-lg shadow-${colorClass}/25`
                                        : 'bg-surface-alt text-text-muted border border-border hover:border-text-muted'
                                    }
                `}
                                style={isEnabled ? { backgroundColor: `var(--color-${colorClass})` } : {}}
                            >
                                {MODEL_NAMES[modelId]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Start button */}
            <button
                onClick={onStart}
                disabled={!canStart}
                className={`
          w-full py-4 rounded-xl font-semibold text-lg transition-all
          ${canStart
                        ? 'bg-gradient-to-r from-claude via-gpt to-gemini text-white hover:opacity-90 shadow-lg'
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
                    <li>1. Copy each model's prompt to their respective chat interfaces</li>
                    <li>2. Paste their responses back here</li>
                    <li>3. Models see each other's perspectives and refine their answers</li>
                    <li>4. After consensus (or max 5 rounds), generate a synthesis</li>
                </ol>
            </div>
        </div>
    );
}
