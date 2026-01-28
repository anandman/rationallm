import { useEffect } from 'react';
import { ModelCard } from './ModelCard';
import { ProgressIndicator } from './ProgressIndicator';

export function RoundDisplay({
    currentRound,
    enabledModels,
    responses,
    getPromptForModel,
    onUpdateResponse,
    onNextRound,
    canProceed,
    shouldShowSynthesis,
    isAutomated,
    isRunning,
    onRunAutomatedRound,
    onToggleModel
}) {
    // Auto-run when entering a new round in automated mode
    useEffect(() => {
        if (isAutomated && !isRunning && !canProceed) {
            // Check if no responses have been generated yet for this round
            const hasAnyResponse = enabledModels.some(id => responses[id]?.text?.trim());
            if (!hasAnyResponse) {
                onRunAutomatedRound?.();
            }
        }
    }, [isAutomated, isRunning, canProceed, enabledModels, responses, onRunAutomatedRound]);

    // Auto-advance when all responses are ready in automated mode
    useEffect(() => {
        if (isAutomated && canProceed && !isRunning) {
            // Small delay to let user see the responses
            // If tab is hidden, reduce delay to avoid throttling
            const delay = document.hidden ? 50 : 1500;
            const timer = setTimeout(() => {
                onNextRound();
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [isAutomated, canProceed, isRunning, onNextRound]);

    const anyError = enabledModels.some(id => responses[id]?.error);

    return (
        <div className="max-w-7xl mx-auto">
            <ProgressIndicator currentRound={currentRound} phase="deliberation" />

            <h2 className="text-2xl font-bold text-center mb-6">
                Round {currentRound}
                {isRunning && (
                    <span className="ml-3 text-base font-normal text-text-muted">
                        Generating responses...
                    </span>
                )}
            </h2>

            {/* Model cards grid */}
            <div className={`
                grid gap-6 mb-8
                ${enabledModels.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : ''}
                ${enabledModels.length === 2 ? 'grid-cols-1 md:grid-cols-2' : ''}
                ${enabledModels.length >= 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : ''}
            `}>
                {enabledModels.map(modelId => (
                    <ModelCard
                        key={modelId}
                        modelId={modelId}
                        prompt={getPromptForModel(modelId)}
                        response={responses[modelId]?.text || ''}
                        status={responses[modelId]?.status}
                        loading={responses[modelId]?.loading}
                        error={responses[modelId]?.error}
                        onResponseChange={(text) => onUpdateResponse(modelId, text)}
                        isAutomated={isAutomated}
                        onDisable={() => onToggleModel(modelId)}
                    />
                ))}
            </div>

            {/* Next button */}
            <div className="flex justify-center gap-4">
                {anyError && (
                    <button
                        onClick={onRunAutomatedRound}
                        disabled={isRunning}
                        className="px-6 py-3 rounded-xl font-semibold bg-amber-500 text-white hover:opacity-90 transition-all"
                    >
                        Retry Failed
                    </button>
                )}
                <button
                    onClick={onNextRound}
                    disabled={!canProceed || isRunning}
                    className={`
                        px-8 py-3 rounded-xl font-semibold transition-all
                        ${canProceed && !isRunning
                            ? 'bg-[#4285f4] text-white hover:opacity-90 shadow-lg shadow-[#4285f4]/25'
                            : 'bg-surface-alt text-text-muted cursor-not-allowed'
                        }
                    `}
                >
                    {shouldShowSynthesis
                        ? 'Proceed to Synthesis'
                        : `Continue to Round ${currentRound + 1}`
                    }
                </button>
            </div>

            {/* Helper text */}
            <p className="text-center text-text-muted text-sm mt-4">
                {isRunning
                    ? 'Waiting for all models to respond...'
                    : canProceed
                        ? shouldShowSynthesis
                            ? isAutomated
                                ? 'All models ready - proceeding to synthesis...'
                                : 'All models are ready to conclude or max rounds reached'
                            : isAutomated
                                ? 'All responses received - advancing to next round...'
                                : 'All responses received. Click to generate next round prompts.'
                        : isAutomated
                            ? anyError
                                ? 'Some requests failed. Click Retry or fix and continue.'
                                : 'Generating responses automatically...'
                            : 'Paste all model responses to continue'
                }
            </p>
        </div>
    );
}
