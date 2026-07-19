# RationaLLM — Developer Reference

## Brief
Browser-only SPA that orchestrates a structured multi-round debate
("deliberation") between multiple LLMs (Claude, GPT, Gemini, Grok, Mistral,
DeepSeek, anything on OpenRouter), then synthesizes their answers into one.
Two modes: **Manual** (user copy-pastes prompts/responses between the app and
web chatbots) and **Automated** (API keys in localStorage, calls made directly
from the browser). No backend.

## Stack
React 19 · Vite 7 · Tailwind CSS 4 (via @tailwindcss/vite) · react-markdown +
remark-gfm. Plain JS/JSX (no TypeScript). No test framework. ESLint flat config.

## Status
Live at https://anandman.github.io/rationallm/ (GitHub Pages, served from
`docs/` on `main`). Actively developed, entirely AI-built.

## Commands (verified 2026-07-18)
```bash
npm install        # setup
npm run dev        # dev server on http://localhost:5173
npm run lint       # ESLint (passes clean; docs/ is ignored)
npm run build      # wipes docs/assets, builds into docs/
npm run preview    # serve the production build locally
```
**Deploy** = `npm run build`, then commit the `docs/` changes and push to
`main`. There is no CI; the live site lags until built output is committed.

## Architecture (capabilities)
- **Deliberation engine** (`useDeliberation` hook, ~600 lines): phase state
  machine `setup → deliberation → synthesis → complete`; tracks rounds with
  per-participant responses; decides when synthesis is available; auto-saves
  everything to localStorage; session history with load/delete; migrates old
  provider-keyed state shapes on load.
- **Participants, not providers**: everything is keyed by participant id
  (`provider:model`), with a `participants` map holding
  `{provider, model, label, color}`. Several participants can share one
  endpoint — e.g. three OpenRouter models or three Ollama models
  deliberating. Manual-mode quick-picks use bare provider ids.
- **Model discovery** (`utils/modelList.js`): fetches each endpoint's live
  model list for dropdown pickers — OpenAI-style GET /models for
  OpenRouter/Ollama-vLLM/OpenAI/xAI/Mistral/DeepSeek, special-cased
  Anthropic and Google listings; session-cached; falls back to a custom
  model-ID text input if the fetch fails.
- **Prompt generation**: Round 1 (plain query + status request), Round N
  (query + own previous answer + all other models' answers + critique
  instructions), and synthesis (merge final answers). Cross-model questions
  via `@Claude` / `@GPT` / `@Gemini` mentions are a prompt convention only.
- **STATUS protocol**: every response must end with
  `STATUS: CONTINUE | SATISFIED | IMPASSE` on its own line; the app parses
  this free text to decide whether another round is wanted. Shared by manual
  and automated modes — that's why it's text, not structured output.
- **API layer** (`utils/api.js`): unified `callLLM` routing to OpenRouter or
  direct APIs (OpenAI-compatible for OpenAI/xAI/Mistral/DeepSeek, plus
  native Anthropic and Google Gemini endpoints); retries on 429/5xx/network
  errors; parallel fan-out to all models with per-model progress callbacks.
- **Model registry** (`utils/models.js`): provider metadata, default model
  IDs (direct and OpenRouter forms), display names/colors.
- **Ollama provider**: local models via an Ollama server's OpenAI-compatible
  endpoint (`{url}/v1/chat/completions`). The server URL lives in
  `apiKeys.ollama` (it's a URL, not a key) so availability/persistence reuse
  the API-key plumbing. Never routed through OpenRouter.
- **UI**: one component per phase (Setup, RoundDisplay, Synthesis, FinalView)
  plus HistorySidebar, FollowUpChat (post-synthesis chat with full context),
  markdown rendering, and an ErrorBoundary offering "Reset App Data".
- **Persistence**: localStorage keys — `rationallm_current` (active session),
  plus history, API keys, settings, and preferences keys.

## Key Design Decisions
- **No backend, ever.** API keys live in localStorage; calls go straight from
  the browser (Anthropic requires the
  `anthropic-dangerous-direct-browser-access` header). Rationale: zero infra,
  keys never touch a server, deployable as static files.
- **Deploy-from-`docs/`** on `main` (GitHub Pages "deploy from branch").
  Built output is committed to git deliberately.
- **`docs/` is shared** between build output and this file. Therefore
  `emptyOutDir: false` in vite.config.js and the build script deletes only
  `docs/assets/`. Do not re-enable `emptyOutDir`.
- **STATUS text protocol over structured output** so manual copy-paste mode
  and automated mode share one code path.
- **OpenRouter is just an endpoint** (changed 2026-07-19, user-initiated):
  the old global "Use OpenRouter for all calls" flag is gone. Every
  participant is explicitly bound to one endpoint + model; OpenRouter is
  simply the endpoint with the biggest catalog.
- **Recovery over prevention**: model failure mid-deliberation offers
  "Exclude this model"; corrupted localStorage is handled by the
  ErrorBoundary reset rather than migrations.

## Code Conventions
- Function components + hooks only; all deliberation logic in
  `useDeliberation`, components stay presentational.
- Tailwind utility classes with custom design tokens (`bg-surface`,
  `border-border`, `text-text-muted`, …) defined in `src/index.css`.
- Participant ids (`provider:model`, or bare provider for manual mode) are
  the universal keys across responses and selection; provider ids key the
  API-key map and endpoint registry.
- JSDoc comments on utility functions; no TypeScript.

## Safety & Permissions
- `test.config.json` holds real API keys — gitignored, never commit it
  (`test.config.example.json` is the committed template).
- Never hardcode keys or move them out of localStorage.
- `docs/` build artifacts MUST be committed (they are the deployment), but
  never hand-edit them.

## Domain Vocabulary
- **Deliberation**: one full multi-round session for a single query.
- **Round**: one pass where every enabled model answers/critiques.
- **STATUS**: a model's end-of-response verdict (CONTINUE/SATISFIED/IMPASSE).
- **Synthesis**: final merge of all models' answers by a chosen model.
- **Manual vs Automated mode**: copy-paste routing vs direct API calls.

## Gotchas
- **`docs/` dual role**: it is both GitHub Pages root and docs home. The
  build only clears `docs/assets/`; `DEVELOPMENT.md` and `.nojekyll` survive
  (`.nojekyll`'s source of truth is `public/.nojekyll`).
- **Stale live site**: code changes do nothing for users until someone runs
  `npm run build` and commits `docs/`. Check `git status` for unbuilt work.
- **ESLint must ignore `docs/`** (it does, in eslint.config.js) or minified
  bundles produce hundreds of false errors.
- **Adding a provider** touches PROVIDERS/DEFAULT_MODELS/MODEL_DISPLAY in
  `utils/models.js`, a case in `callLLM`, and possibly `modelList.js` if its
  listing isn't OpenAI-style.
- **Concurrent local models serialize**: several Ollama participants in one
  round all fire at once; the Ollama server queues generation on the GPU, so
  a 3-model round takes roughly 3× one model's time. Expected, not a bug.
- **Ollama needs CORS + plain HTTP**: the browser calls the Ollama server
  directly, so the server must allow the app's origin
  (`OLLAMA_ORIGINS=*` or the specific origin). The hosted HTTPS site cannot
  call `http://host:11434` (mixed content) — Ollama works from local
  dev/preview, or put the server behind HTTPS (e.g. `tailscale serve`).
- **UI is mode-dependent**: API config and the Synthesis-model selector
  render only in Automated mode (both are meaningless for manual copy-paste).
- **STATUS parsing quirks** (`parseStatus` in `utils/prompts.js`): a missing
  or mangled STATUS line yields `null`, which blocks consensus — deliberation
  then only ends at MAX_ROUNDS. An `@Claude`/`@GPT`/`@Gemini` mention forces
  the status to CONTINUE even if the model wrote SATISFIED.
