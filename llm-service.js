const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { HumanMessage } = require('@langchain/core/messages');

class LLMService {
    constructor() {
        this.provider = null;
        this.model = null;
        this.apiKeys = {
            openai: '',
            claude: '',
            perplexity: ''
        };
        this.currentProvider = 'openai'; // default
    }

    /**
     * Initialize the LLM service with configuration
     * @param {Object} config - Configuration object
     * @param {string} config.provider - LLM provider ('openai', 'claude', 'perplexity')
     * @param {Object} config.apiKeys - API keys for different providers
     */
    initialize(config) {
        this.currentProvider = config.provider || 'openai';
        this.apiKeys = { ...this.apiKeys, ...config.apiKeys };
        
        this.setupProvider();
    }

    setupProvider() {
        switch (this.currentProvider.toLowerCase()) {
            case 'openai':
                if (!this.apiKeys.openai) {
                    throw new Error('OpenAI API key not configured');
                }
                this.model = new ChatOpenAI({
                    apiKey: this.apiKeys.openai,
                    modelName: 'gpt-5-chat-latest',
                    temperature: 0.1,
                    maxTokens: 400
                });
                break;

            case 'claude':
                if (!this.apiKeys.claude) {
                    throw new Error('Claude API key not configured');
                }
                this.model = new ChatAnthropic({
                    apiKey: this.apiKeys.claude,
                    modelName: 'claude-3-5-sonnet-20241022',
                    temperature: 0.1,
                    maxTokens: 400
                });
                break;

            case 'perplexity':
                if (!this.apiKeys.perplexity) {
                    throw new Error('Perplexity API key not configured');
                }
                // Perplexity uses OpenAI-compatible API
                this.model = new ChatOpenAI({
                    apiKey: this.apiKeys.perplexity,
                    modelName: 'sonar-pro',  // changed to a permitted model
                    temperature: 0.1,
                    maxTokens: 400,
                    configuration: {
                        baseURL: 'https://api.perplexity.ai'
                    }
                });
                break;

            default:
                throw new Error(`Unsupported LLM provider: ${this.currentProvider}`);
        }
    }

    /**
     * Analyze chart image with structured output
     * @param {string} imageBase64 - Base64 encoded image
     * @returns {Promise<string>} - JSON string with analysis results
     */
    async analyzeChart(imageBase64) {
        if (!this.model) {
            throw new Error('LLM service not initialized');
        }

        console.log(`[LLM Service] Starting analysis with provider: ${this.currentProvider}`);
        console.log(`[LLM Service] Image data length: ${imageBase64 ? imageBase64.length : 0} characters`);

        const prompt = this.getAnalysisPrompt();
        
        try {
            // For providers that support vision (OpenAI and Claude)
            if (this.currentProvider === 'openai' || this.currentProvider === 'claude') {
                console.log(`[LLM Service] Using vision-enabled provider: ${this.currentProvider}`);
                
                const message = new HumanMessage({
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/png;base64,${imageBase64}`
                            }
                        }
                    ]
                });

                console.log(`[LLM Service] Sending request to ${this.currentProvider}...`);
                const response = await this.model.invoke([message]);
                
                console.log(`[LLM Service] Raw response from ${this.currentProvider}:`, response);
                console.log(`[LLM Service] Response content:`, response.content);
                console.log(`[LLM Service] Response content type:`, typeof response.content);
                
                // Extract JSON from markdown code blocks if present
                const cleanedContent = this.extractJsonFromResponse(response.content);
                console.log(`[LLM Service] Cleaned content:`, cleanedContent);
                
                return cleanedContent;
            } else {
                // For Perplexity or other text-only providers
                console.log(`[LLM Service] Using text-only provider: ${this.currentProvider}`);
                const textPrompt = `${prompt}\n\nNote: Image analysis not available with current provider. Please provide text-based market analysis.`;
                const message = new HumanMessage(textPrompt);
                const response = await this.model.invoke([message]);
                
                console.log(`[LLM Service] Text-only response:`, response);
                
                // Return a default structure for text-only providers
                const fallbackResponse = JSON.stringify({
                    decision: "Wait",
                    confidence: 50,
                    reason: "Text-only analysis - image vision not supported",
                    scenarios: [],
                    levels: {
                        support: [],
                        resistance: []
                    }
                });
                
                console.log(`[LLM Service] Returning fallback response:`, fallbackResponse);
                return fallbackResponse;
            }
        } catch (error) {
            console.error(`[LLM Service] Analysis error (${this.currentProvider}):`, error);
            throw new Error(`Analysis failed with ${this.currentProvider}: ${error.message}`);
        }
    }

    /**
     * Extract JSON from response that might be wrapped in markdown code blocks
     * @param {string} content - Raw response content
     * @returns {string} - Clean JSON string
     */
    extractJsonFromResponse(content) {
        if (!content) return '{}';
        
        // Remove markdown code block markers if present
        let cleaned = content.trim();
        
        // Check for ```json ... ``` pattern
        const jsonBlockMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
            cleaned = jsonBlockMatch[1].trim();
            console.log(`[LLM Service] Extracted JSON from markdown block`);
        }
        
        // Check for ``` ... ``` pattern (without json specifier)
        else if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
            cleaned = cleaned.slice(3, -3).trim();
            console.log(`[LLM Service] Extracted content from generic code block`);
        }
        
        // Validate that it's valid JSON
        try {
            JSON.parse(cleaned);
            console.log(`[LLM Service] JSON validation successful`);
            return cleaned;
        } catch (error) {
            console.error(`[LLM Service] JSON validation failed:`, error);
            console.error(`[LLM Service] Problematic content:`, cleaned);
            
            // Return a fallback response
            return JSON.stringify({
                decision: "Wait",
                confidence: 50,
                reason: "JSON parsing error",
                scenarios: [],
                levels: {
                    support: [],
                    resistance: []
                }
            });
        }
    }

    getAnalysisPrompt() {
        return `You are a trading assistant for intraday scalpers. Analyze this chart screenshot that may contain labels like HH LH HL LL BOS ChoCH PDH supply demand premium discount and price levels.

Goal: Return the most actionable decision now using only what is visible. Be concise. No disclaimers.

Rules:
• Use exact numbers visible on chart when possible
• If numbers not fully visible give nearest integer
• Prefer 1 or 3 minute context if both visible
• Keep total characters under 420
• Return ONLY valid JSON matching the schema
• Use arrays even for single scenario

Required JSON Schema:
{
  "decision": "Long" | "Short" | "Wait",
  "confidence": 1-100,
  "reason": "string (max 80 chars)",
  "scenarios": [
    {
      "side": "Long" | "Short",
      "entry": "string",
      "stop": "string", 
      "targets": ["string"],
      "conditions": "string (max 60 chars)",
      "invalidate": "string (max 40 chars)"
    }
  ],
  "levels": {
    "support": ["string"],
    "resistance": ["string"]
  }
}

Analyze and reply with JSON only.`;
    }

    /**
     * Get current provider information
     * @returns {Object} Provider info
     */
    getProviderInfo() {
        return {
            provider: this.currentProvider,
            hasVisionSupport: this.currentProvider === 'openai' || this.currentProvider === 'claude',
            modelName: this.getModelName()
        };
    }

    getModelName() {
        switch (this.currentProvider) {
            case 'openai': return 'gpt-4o';
            case 'claude': return 'claude-3-5-sonnet-20241022';
            case 'perplexity': return 'llama-3.1-sonar-large-128k-online';
            default: return 'unknown';
        }
    }

    /**
     * Switch to a different provider
     * @param {string} provider - New provider name
     */
    switchProvider(provider) {
        if (provider !== this.currentProvider) {
            this.currentProvider = provider;
            this.setupProvider();
        }
    }
}

module.exports = LLMService;
