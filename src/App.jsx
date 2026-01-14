import { useState } from 'react';
import { useDeliberation } from './hooks/useDeliberation';
import { SetupScreen } from './components/SetupScreen';
import { RoundDisplay } from './components/RoundDisplay';
import { SynthesisScreen } from './components/SynthesisScreen';
import { FinalView } from './components/FinalView';
import { HistorySidebar } from './components/HistorySidebar';

function App() {
  const {
    state,
    history,
    setQuery,
    toggleModel,
    startDeliberation,
    updateResponse,
    nextRound,
    updateSynthesis,
    complete,
    startNew,
    loadFromHistory,
    deleteFromHistory,
    getPromptForModel,
    getCurrentResponses,
    canProceedToNextRound,
    shouldShowSynthesis
  } = useDeliberation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (state.phase) {
      case 'setup':
        return (
          <SetupScreen
            query={state.query}
            enabledModels={state.enabledModels}
            onQueryChange={setQuery}
            onToggleModel={toggleModel}
            onStart={startDeliberation}
          />
        );

      case 'deliberation':
        return (
          <RoundDisplay
            currentRound={state.currentRound}
            enabledModels={state.enabledModels}
            responses={getCurrentResponses()}
            getPromptForModel={getPromptForModel}
            onUpdateResponse={updateResponse}
            onNextRound={nextRound}
            canProceed={canProceedToNextRound()}
            shouldShowSynthesis={shouldShowSynthesis()}
          />
        );

      case 'synthesis':
        return (
          <SynthesisScreen
            synthesisPrompt={state.synthesis.prompt}
            synthesisResponse={state.synthesis.response}
            onUpdateSynthesis={updateSynthesis}
            onComplete={complete}
            currentRound={state.currentRound}
          />
        );

      case 'complete':
        return (
          <FinalView
            deliberation={state}
            onStartNew={startNew}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-border bg-surface-alt/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={setSidebarOpen.bind(null, true)}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="View history"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <button
            onClick={startNew}
            className="text-sm font-medium text-text-muted hover:text-text transition-colors"
          >
            {state.phase !== 'setup' ? 'New Deliberation' : ''}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 py-8">
        {renderContent()}
      </main>

      {/* History sidebar */}
      <HistorySidebar
        history={history}
        onSelect={loadFromHistory}
        onDelete={deleteFromHistory}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
}

export default App;
