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
    shouldShowSynthesis
}) {
    return (
        <div className="max-w-7xl mx-auto">
            <ProgressIndicator currentRound={currentRound} phase="deliberation" />

            <h2 className="text-2xl font-bold text-center mb-6">
                Round {currentRound}
            </h2>

            {/* Model cards grid */}
            <div className={`
        grid gap-6 mb-8
        ${enabledModels.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : ''}
        ${enabledModels.length === 2 ? 'grid-cols-1 md:grid-cols-2' : ''}
        ${enabledModels.length === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : ''}
      `}>
                {enabledModels.map(modelId => (
                    <ModelCard
                        key={modelId}
                        modelId={modelId}
                        prompt={getPromptForModel(modelId)}
                        response={responses[modelId]?.text || ''}
                        status={responses[modelId]?.status}
                        onResponseChange={(text) => onUpdateResponse(modelId, text)}
                    />
                ))}
            </div>

            {/* Next button */}
            <div className="flex justify-center">
                <button
                    onClick={onNextRound}
                    disabled={!canProceed}
                    className={`
            px-8 py-3 rounded-xl font-semibold transition-all
            ${canProceed
                            ? 'bg-gemini text-white hover:opacity-90 shadow-lg shadow-gemini/25'
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
                {canProceed
                    ? shouldShowSynthesis
                        ? 'All models are ready to conclude or max rounds reached'
                        : 'All responses received. Click to generate next round prompts.'
                    : 'Paste all model responses to continue'
                }
            </p>
        </div>
    );
}
