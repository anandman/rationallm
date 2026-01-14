# RationaLLM

A semi-manual tool that orchestrates multi-model deliberation and rationalization. RationaLLM helps you get the best possible answer by facilitating a structured debate between multiple AI models (Claude, GPT, and Gemini).

## Purpose

RationaLLM is designed to overcome individual model biases and hallucinations by cross-pollinating their outputs. Instead of relying on a single model, you act as the "router," passing prompts and responses between models to encourage them to:

1.  **Critique** each other's reasoning.
2.  **Refine** their own answers based on new perspectives.
3.  **Converge** on a more accurate, nuanced consensus.

*NOTE: RationaLLM currently uses manual routing so that you can use the chatbot UIs which have higher limits for tokens and messages than the APIs. A future version might have API support since that can be automnated.*

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

## Deployment

To deploy your own version to GitHub Pages:

1.  Fork this repository.
2.  Go to **Settings > Pages** in your GitHub repository.
3.  Under **Build and deployment**, select **Source** as "Deploy from a branch".
4.  Select the `main` branch and the `/docs` folder.
5.  Click **Save**.

## Credits

Created by **Anand Mandapati**.

This project was built entirely by AI using **Google Antigravity** and **Claude Opus**.
