# SnapScalp

AI-powered desktop overlay tool that analyzes trading charts in real-time and provides actionable trade recommendations for intraday scalpers.

## Features

- **Real-time Chart Analysis**: Captures and analyzes any trading chart on your screen every 30 seconds
- **AI-Powered Insights**: Uses GPT-4, Claude, or Perplexity to identify trade setups, support/resistance levels, and market structure
- **Screen Area Selection**: Select any chart area for continuous monitoring
- **Multiple AI Providers**: Switch between OpenAI, Claude, and Perplexity APIs
- **Always-on-Top Overlay**: Stays visible while you trade on other platforms

<img width="10639" height="5629" alt="snapscalp" src="https://github.com/user-attachments/assets/f02757d9-9692-4e54-8520-54b6034c5430" />


## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Keys
Copy `env.template` to `dev.env` and add your API keys:
```bash
cp env.template dev.env
```

Edit `dev.env`:
```
openai_key=your_openai_api_key_here
claudeai_key=your_claude_api_key_here
perplexityai_key=your_perplexity_api_key_here
```

### 3. Run the App
```bash
npm run dev
```

## Usage

1. **Select Chart Area**: Click "Select Area" or use `Cmd/Ctrl+Shift+A` to define the chart region to monitor
2. **Start Analysis**: Click "Start Analysis" to begin real-time monitoring
3. **View Results**: Get trade recommendations with entry/exit levels, confidence scores, and market analysis
4. **Switch AI Providers**: Toggle between different AI models based on your preference

## Tech Stack

- **Electron**: Cross-platform desktop app
- **LangChain**: AI model integration
- **Sharp**: Image processing for chart screenshots
- **Multiple AI APIs**: OpenAI GPT-4, Claude 3.5 Sonnet, Perplexity

## Build for Production

```bash
npm run build
```

## License

MIT
