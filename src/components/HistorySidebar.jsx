import { MODEL_NAMES } from '../utils/prompts';

export function HistorySidebar({ history, onSelect, onDelete, isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={onClose}
            />

            {/* Sidebar */}
            <div className="fixed top-0 left-0 h-full w-80 bg-surface-alt border-r border-border z-50 flex flex-col">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="font-semibold">History</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {history.length === 0 ? (
                        <p className="text-text-muted text-sm text-center py-8">
                            No completed deliberations yet
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {history.map(item => (
                                <div
                                    key={item.id}
                                    className="bg-surface rounded-lg border border-border p-3 hover:border-text-muted transition-colors cursor-pointer group"
                                    onClick={() => {
                                        onSelect(item);
                                        onClose();
                                    }}
                                >
                                    <p className="text-sm text-text line-clamp-2 mb-2">
                                        {item.query}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-text-muted">
                                            {item.currentRound} round{item.currentRound > 1 ? 's' : ''} • {item.enabledModels.map(m => (MODEL_NAMES[m] || m)[0]).join('')}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(item.id);
                                            }}
                                            className="text-xs text-text-muted hover:text-claude opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                    <span className="text-xs text-text-muted">
                                        {new Date(item.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
