# RationaLLM

A semi-manual tool that orchestrates multi-model deliberation and rationalization. RationaLLM helps you get the best possible answer by facilitating a structured debate between multiple AI models (Claude, GPT, and Gemini).

## Purpose

RationaLLM is designed to overcome individual model biases and hallucinations by cross-pollinating their outputs. Instead of relying on a single model, you act as the "router," passing prompts and responses between models to encourage them to:

1.  **Critique** each other's reasoning.
2.  **Refine** their own answers based on new perspectives.
3.  **Converge** on a more accurate, nuanced consensus.

### Modes
1.  **Automated Mode** (New!): Enter your API keys to have RationaLLM automatically run the rounds for you.
2.  **Manual Mode**: Classic copy-paste workflow. Useful if you don't have API keys or want to use web interfaces.

## Supported Models
- **OpenAI**: GPT-4o, o1, etc.
- **Anthropic**: Claude 3.5 Sonnet, Opus
- **Google**: Gemini 1.5 Pro, 2.0 Flash
- **xAI**: Grok 2
- **Mistral**: Mistral Large, Codestral
- **DeepSeek**: DeepSeek V3
- **Others**: 400+ models via OpenRouter support

## How It Works

The tool runs entirely in your browser (no backend required) and guides you through a multi-round process:

1.  **Setup**: Enter your query and select which models to include.
2.  **Deliberation Rounds**:
    *   The tool generates optimized prompts for each model.
    *   You copy the prompt to the respective AI (e.g., ChatGPT, Claude.ai, Gemini).
    *   You paste their response back into RationaLLM.
    *   RationaLLM parses the response to see if the model wants to **CONTINUE** (refine further) or is **SATISFIED**.
3.  **Synthesis**: Once models reach a consensus (or max rounds are hit), a final synthesis prompt is generated to combine the best insights from all models into one comprehensive answer. You may provide this to the model of your choice.
4.  **History**: Your sessions are auto-saved locally so you can review past deliberations.

## Usage

### On the Web
You can use the live version hosted here:
[**https://anandman.github.io/rationallm/**](https://anandman.github.io/rationallm/)

### Running Locally

1.  Clone this repository:
    ```bash
    git clone https://github.com/anandman/rationallm.git
    cd rationallm
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open `http://localhost:5173` in your browser.
5.  (Optional) For automated testing, copy `test.config.example.json` to `test.config.json` and add your API keys.

## API Configuration
To use Automated Mode, you can either:
- **Recommended**: Use an **OpenRouter** key to access all models with a single key.
- **Direct**: Enter individual API keys for OpenAI, Anthropic, Google, etc.
- Keys are stored securely in your browser's `localStorage` and never sent to our servers.

## Smart Features
- **Persistence**: Your API keys, model selections, and settings are automatically saved.
- **Smart Defaults**: The app auto-selects models based on which API keys you provide.
- **Error Recovery**: If a model fails (e.g., quota exceeded), you can click "Exclude this model" to seamlessly continue the deliberation without it.
- **Data Safety**: We use robust error boundaries to protect your session. If data ever gets corrupted, a "ReferenceError" or crash screen will offer a "Reset App Data" button to fix it.

## Troubleshooting
If you encounter a blank screen or crashLoop:
1.  The app now includes an **Error Boundary**.
2.  Click the red **"Reset App Data"** button on the crash screen.
3.  This clears your local cache and restores the app to a clean state.

## Deployment

To deploy your own version to GitHub Pages:

1.  Fork this repository.
2.  Go to **Settings > Pages** in your GitHub repository.
3.  Under **Build and deployment**, select **Source** as "Deploy from a branch".
4.  Select the `main` branch and the `/docs` folder.
5.  Click **Save**.

## Credits

Created by **Anand Mandapati**.

This project was built entirely by AI using **Google Antigravity** and **Claude Opus**, fixed by **Google Gemini**.