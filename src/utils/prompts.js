// Prompt generation utilities for RationaLLM

import { MODEL_DISPLAY } from './models.js';

// Dynamic model names from models.js
export const MODEL_NAMES = Object.fromEntries(
    Object.entries(MODEL_DISPLAY).map(([id, info]) => [id, info.shortName])
);

export const MODEL_COLORS = Object.fromEntries(
    Object.entries(MODEL_DISPLAY).map(([id]) => [id, id])
);

/**
 * Generate Round 1 prompt (same for all models)
 */
export function generateRound1Prompt(query) {
    return `${query}

Please provide your answer. Then indicate whether you'd want to see how other AI models answered this question to refine your response. IMPORTANT: your reply MUST end with exactly one line in this format:
STATUS: CONTINUE (yes, show me other perspectives) or SATISFIED (my answer is complete)`;
}

// Resolve a display label for a participant id, with legacy fallbacks
function labelFor(id, labels) {
    return labels?.[id] || MODEL_NAMES[id] || id;
}

// Reasoning models (DeepSeek R1 etc.) wrap chain-of-thought in <think> tags;
// keep it out of cross-model context and synthesis input
function stripThink(text) {
    return (text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Generate Round N prompt with cross-model context.
 * labels maps participant id -> display name.
 */
export function generateRoundNPrompt(query, modelId, ownResponse, othersResponses, labels) {
    const otherModelsText = Object.entries(othersResponses)
        .filter(([id]) => id !== modelId)
        .map(([id, response]) => `[${labelFor(id, labels)}] said:\n${stripThink(response)}`)
        .join('\n\n');

    const mentionExamples = Object.keys(othersResponses)
        .filter(id => id !== modelId)
        .map(id => `@${labelFor(id, labels)}`)
        .join(', ') || '@ModelName';

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
4. Optionally: a direct question for a specific model (use ${mentionExamples})

IMPORTANT: your reply MUST end with exactly one line in this format:
STATUS: SATISFIED (ready to conclude) | CONTINUE (want another round) | IMPASSE (fundamental disagreement, won't resolve)`;
}

/**
 * Generate synthesis prompt after deliberation
 */
export function generateSynthesisPrompt(query, finalResponses, roundCount, labels) {
    const modelCount = Object.keys(finalResponses).length;
    const responsesText = Object.entries(finalResponses)
        .map(([id, response]) => `${labelFor(id, labels)}'s final answer:\n${stripThink(response)}`)
        .join('\n\n');

    return `${modelCount} AI model${modelCount > 1 ? 's have' : ' has'} deliberated on this query:

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
export function parseStatus(responseText, participantLabels = []) {
    if (!responseText) return null;

    // If model tags another model (asking a question), force status to CONTINUE
    // even if they explicitly wrote SATISFIED.
    // The prompt instructs: "Optionally: a direct question... (use @<name>)"
    const names = participantLabels.length
        ? participantLabels.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        : ['Claude', 'GPT', 'Gemini'];
    // Ignore <think> chain-of-thought when looking for real mentions
    if (new RegExp(`@(${names.join('|')})`, 'i').test(stripThink(responseText))) {
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

    // Some models (reasoning/local ones especially) never emit a STATUS
    // line despite instructions. They must not block consensus forever —
    // only models that DID indicate a status get a vote.
    const indicated = statuses.filter(Boolean);

    // No signal from anyone: keep going (MAX_ROUNDS still backstops)
    if (indicated.length === 0) return false;

    // If any voting model says CONTINUE, keep going
    if (indicated.some(s => s === 'continue')) return false;

    // All votes are SATISFIED or IMPASSE
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
    const label = (id) => deliberation.participants?.[id]?.label || MODEL_NAMES[id] || id;

    lines.push(`# RationaLLM Deliberation`);
    lines.push('');
    lines.push(`**Query:** ${deliberation.query}`);
    lines.push('');
    lines.push(`**Models:** ${deliberation.enabledModels.map(label).join(', ')}`);
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
                lines.push(`### ${label(modelId)}`);
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
