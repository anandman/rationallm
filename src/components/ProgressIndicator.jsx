export function ProgressIndicator({ currentRound, phase, maxRounds = 5 }) {
    const steps = [];

    // Add round steps (up to current round or all if complete)
    const roundsToShow = phase === 'complete' ? currentRound : Math.min(currentRound + 1, maxRounds);
    for (let i = 1; i <= roundsToShow; i++) {
        steps.push({
            id: `round-${i}`,
            label: `Round ${i}`,
            status: i < currentRound ? 'complete' : i === currentRound && phase === 'deliberation' ? 'current' : 'upcoming'
        });
    }

    // Add synthesis step
    steps.push({
        id: 'synthesis',
        label: 'Synthesis',
        status: phase === 'synthesis' ? 'current' : phase === 'complete' ? 'complete' : 'upcoming'
    });

    // Add complete step
    steps.push({
        id: 'complete',
        label: 'Complete',
        status: phase === 'complete' ? 'complete' : 'upcoming'
    });

    return (
        <div className="flex items-center justify-center gap-2 flex-wrap py-4">
            {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                    <div
                        className={`
              px-3 py-1.5 rounded-full text-sm font-medium transition-all
              ${step.status === 'complete'
                                ? 'bg-gpt/20 text-gpt'
                                : step.status === 'current'
                                    ? 'bg-gemini text-white shadow-lg shadow-gemini/25'
                                    : 'bg-surface-alt text-text-muted'
                            }
            `}
                    >
                        {step.status === 'complete' && (
                            <span className="mr-1">✓</span>
                        )}
                        {step.label}
                    </div>

                    {index < steps.length - 1 && (
                        <div className={`
              w-6 h-0.5 mx-1
              ${step.status === 'complete' ? 'bg-gpt/50' : 'bg-border'}
            `} />
                    )}
                </div>
            ))}
        </div>
    );
}
