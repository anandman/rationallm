import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 max-w-4xl mx-auto font-mono text-sm overflow-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                        <h1 className="text-xl font-bold text-red-700 mb-4">React Error Caught</h1>
                        <div className="text-red-900 font-bold mb-4">
                            {this.state.error && this.state.error.toString()}
                        </div>
                        <pre className="text-xs text-red-800 whitespace-pre-wrap">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                            Try Reloading
                        </button>
                        <button
                            onClick={() => {
                                // Clear all RationaLLM keys
                                Object.keys(localStorage).forEach(key => {
                                    if (key.startsWith('rationallm_')) {
                                        localStorage.removeItem(key);
                                    }
                                });
                                window.location.reload();
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                            Reset App Data (Clear Storage)
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
