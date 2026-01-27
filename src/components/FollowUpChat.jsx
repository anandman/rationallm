import { useState, useRef, useEffect } from 'react';
import { MODEL_DISPLAY } from '../utils/models';
import { callLLM } from '../utils/api';

export function FollowUpChat({
    query,
    synthesis,
    availableModels,
    apiKeys,
    useOpenRouter
}) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [selectedModel, setSelectedModel] = useState(availableModels[0] || 'openai');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const buildContextPrompt = () => {
        return `You are continuing a conversation. The user originally asked the following question, and a comprehensive answer was synthesized from multiple AI models deliberating together.

**Original Question:**
${query}

**Synthesized Answer:**
${synthesis}

Now the user has a follow-up question. Please respond helpfully, building on the context above.`;
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setError(null);

        // Add user message to chat
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            // Build the full prompt with context
            const contextPrompt = messages.length === 0 ? buildContextPrompt() : '';
            const fullPrompt = contextPrompt
                ? `${contextPrompt}\n\n**Follow-up Question:**\n${userMessage}`
                : userMessage;

            // For subsequent messages, we need to include history
            let prompt = fullPrompt;
            if (messages.length > 0) {
                // Build conversation history
                const history = messages.map(m =>
                    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
                ).join('\n\n');
                prompt = `${buildContextPrompt()}\n\n**Conversation so far:**\n${history}\n\nUser: ${userMessage}\n\nAssistant:`;
            }

            const response = await callLLM({
                provider: selectedModel,
                prompt,
                apiKeys,
                useOpenRouter
            });

            // Add assistant response
            setMessages(prev => [...prev, { role: 'assistant', content: response, model: selectedModel }]);
        } catch (err) {
            console.error('Follow-up chat error:', err);
            setError(err.message);
            // Remove the user message if we failed
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const display = MODEL_DISPLAY[selectedModel] || MODEL_DISPLAY.openai;

    return (
        <div className="bg-surface-alt rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">Continue the Conversation</h3>
                <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm focus:border-[#4285f4] transition-colors"
                >
                    {availableModels.map(modelId => (
                        <option key={modelId} value={modelId}>
                            {MODEL_DISPLAY[modelId]?.shortName || modelId}
                        </option>
                    ))}
                </select>
            </div>

            {/* Messages area */}
            <div className="h-64 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && !isLoading && (
                    <p className="text-text-muted text-sm text-center py-8">
                        Ask follow-up questions about the synthesis above.
                        <br />
                        The model will have full context of your original query and the synthesized answer.
                    </p>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-xl px-4 py-2 ${msg.role === 'user'
                                    ? 'bg-[#4285f4] text-white'
                                    : 'bg-surface border border-border'
                                }`}
                        >
                            {msg.role === 'assistant' && msg.model && (
                                <div
                                    className="text-xs mb-1 opacity-70"
                                    style={{ color: MODEL_DISPLAY[msg.model]?.color }}
                                >
                                    {MODEL_DISPLAY[msg.model]?.shortName}
                                </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-surface border border-border rounded-xl px-4 py-2">
                            <div className="flex items-center gap-2 text-text-muted text-sm">
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span style={{ color: display.color }}>{display.shortName}</span> is thinking...
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-center py-2">
                        <span className="text-red-500 text-sm">{error}</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a follow-up question..."
                        rows={1}
                        className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm resize-none focus:border-[#4285f4] transition-colors"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${input.trim() && !isLoading
                                ? 'bg-[#4285f4] text-white hover:opacity-90'
                                : 'bg-surface-hover text-text-muted cursor-not-allowed'
                            }`}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
