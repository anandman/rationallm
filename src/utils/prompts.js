// Prompt generation utilities for RationaLLM

export const MODEL_NAMES = {
    claude: 'Claude',
    gpt: 'GPT',
    gemini: 'Gemini'
};

export const MODEL_COLORS = {
    claude: 'claude',
    gpt: 'gpt',
    gemini: 'gemini'
};

/**
 * Generate Round 1 prompt (same for all models)
 */
export function generateRound1Prompt(query) {
    return `${query}

Please provide your answer. At the end, on its own line, indicate if you'd want to see how other AI models answered this question to refine your response:
STATUS: CONTINUE (yes, show me other perspectives) or SATISFIED (my answer is complete)`;
}

/**
 * Generate Round N prompt with cross-model context
 */
export function generateRoundNPrompt(query, modelId, ownResponse, othersResponses, roundNumber) {
    const otherModelsText = Object.entries(othersResponses)
        .filter(([id]) => id !== modelId)
        .map(([id, response]) => `[${MODEL_NAMES[id]}] said:\n${response}`)
        .join('\n\n');

    return `Original query: ${query}

Your previous response:
${ownResponse}

Other models' responses:

${otherModelsText}

---

Review the other perspectives. Then provide:
1. Your updated answer (or confirm yours is unchanged)
2. What points from others you found valuable or incorporated
3. Where you still disagree and why
4. Optionally: a direct question for a specific model (use @Claude, @GPT, or @Gemini)

End with your status on its own line:
STATUS: SATISFIED (ready to conclude) | CONTINUE (want another round) | IMPASSE (fundamental disagreement, won't resolve)`;
}

/**
 * Generate synthesis prompt after deliberation
 */
export function generateSynthesisPrompt(query, finalResponses, roundCount) {
    const responsesText = Object.entries(finalResponses)
        .map(([id, response]) => `${MODEL_NAMES[id]}'s final answer:\n${response}`)
        .join('\n\n');

    return `Three AI models have deliberated on this query:

Query: ${query}

Final positions after ${roundCount} round${roundCount > 1 ? 's' : ''}:

${responsesText}

Please synthesize these into:
1. **Consensus**: What all models agree on
2. **Disagreements**: Where they differ, with each model's reasoning
3. **Evolution**: How the discussion progressed (1-2 sentences)
4. **Recommended answer**: Your synthesized best answer incorporating the strongest points from each`;
}

/**
 * Parse STATUS line from response
 * Returns: 'continue' | 'satisfied' | 'impasse' | null
 */
export function parseStatus(responseText) {
    if (!responseText) return null;

    // If model tags another model (asking a question), force status to CONTINUE
    // even if they explicitly wrote SATISFIED.
    // The prompt instructs: "Optionally: a direct question... (use @Claude...)"
    if (/@(Claude|GPT|Gemini)/i.test(responseText)) {
        return 'continue';
    }

    // Look for STATUS: line (case insensitive)
    const statusMatch = responseText.match(/STATUS:\s*(CONTINUE|SATISFIED|IMPASSE)/i);
    if (statusMatch) {
        return statusMatch[1].toLowerCase();
    }
    return null;
}

/**
 * Check if all models are ready for synthesis
 */
export function shouldProceedToSynthesis(responses) {
    const statuses = Object.values(responses).map(r => r.status);

    // All must have a status
    if (statuses.some(s => !s)) return false;

    // If any says CONTINUE, keep going
    if (statuses.some(s => s === 'continue')) return false;

    // All SATISFIED or mix of SATISFIED/IMPASSE
    return true;
}

/**
 * Check if all responses have content
 */
export function allResponsesFilled(responses, enabledModels) {
    return enabledModels.every(modelId =>
        responses[modelId]?.text?.trim().length > 0
    );
}

/**
 * Generate unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Export deliberation as Markdown
 */
export function exportAsMarkdown(deliberation) {
    const lines = [];

    lines.push(`# RationaLLM Deliberation`);
    lines.push('');
    lines.push(`**Query:** ${deliberation.query}`);
    lines.push('');
    lines.push(`**Models:** ${deliberation.enabledModels.map(m => MODEL_NAMES[m]).join(', ')}`);
    lines.push('');
    lines.push(`**Completed:** ${new Date(deliberation.completedAt || deliberation.createdAt).toLocaleString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Each round
    deliberation.rounds.forEach((round, index) => {
        lines.push(`## Round ${index + 1}`);
        lines.push('');

        deliberation.enabledModels.forEach(modelId => {
            const response = round.responses[modelId];
            if (response?.text) {
                lines.push(`### ${MODEL_NAMES[modelId]}`);
                lines.push('');
                lines.push(response.text);
                lines.push('');
            }
        });
    });

    // Synthesis
    if (deliberation.synthesis?.response) {
        lines.push('---');
        lines.push('');
        lines.push('## Synthesis');
        lines.push('');
        lines.push(deliberation.synthesis.response);
    }

    return lines.join('\n');
}
