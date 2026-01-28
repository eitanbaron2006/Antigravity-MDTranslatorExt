# Aion Extension Updates

## 1.8.17
- **Implemented Retry Mechanism**: Added exponential backoff retry logic (1s, 2s, 4s...) specifically for 429 "Too Many Requests" errors, matching Cline's behavior.
- **Improved API Resilience**: Aion now waits and retries automatically before giving up on quota-limited AI providers.

## 1.8.16
- **Fixed Silent Thinking Loop**: Improved error handling to ensure the "thinking" indicator is always cleared, even on API errors (like 429).
- **Technical Error Messaging**: Added pretty Markdown-formatted error messages for API failures.
- **Syntax Fix**: Resolved a core logic error in the agent loop.

## 1.8.15 - Core Agent Loop Fix
- **Architecture Realignment**: Successfully ported Cline's message handling architecture. System prompt and message history are now passed separately to the API, preventing "Prompt Bloat" and infinite loops.
- **Improved Conversational Context**: The assistant now remembers previous turns correctly through a structured message array instead of a concatenated string.
- **Greeting Logic**: Fixed an issue where the agent would trigger file scanning for simple greetings like "Hi".
- **Code Stability**: Rewrote the `Agent` class to resolve structural inconsistencies and improve task execution flow.

## 1.8.13 - Core Agent Loop Fix
- **Architecture Realignment**: Successfully ported Cline's message handling architecture. System prompt and message history are now passed separately to the API, preventing "Prompt Bloat" and infinite loops.
- **Improved Conversational Context**: The assistant now remembers previous turns correctly through a structured message array instead of a concatenated string.
- **Greeting Logic**: Fixed an issue where the agent would trigger file scanning for simple greetings like "Hi".
- **Code Stability**: Rewrote the `Agent` class to resolve structural inconsistencies and improve task execution flow.

## 1.8.12 - Agent Response Optimization
- **Deduplication Logic**: Fixed an issue where the agent would repeat the same answer in both "Thought" and "Assistant" blocks.
- **Prompt Engineering**: Refined system prompt to ensure clearer separation between internal reasoning and final answers.
- **Structural Integrity**: Pass `createMessage` empty system prompt by default for internal provider handling.

## 1.8.11 - State Persistence & Architecture
- **State Persistence**: Implemented `retainContextWhenHidden: true` to ensure chat history is preserved when switching sidebars or hiding the extension.
- **Modular Provider Architecture**: Refactored `AiService` into a Cline-inspired provider system (`src/core/api`).
- **New Providers**: Added dedicated handlers for Gemini, Anthropic, and OpenAI-compatible APIs (DeepSeek, etc.).
- **Lint & Syntax Fixes**: Resolved multiple architectural inconsistencies and syntax errors in the core service layer.

---

# Legacy Updates (Markdown Translator)
... (rest of the file)

### Changes Made:

- **Added automatic RTL detection**: The extension now automatically detects if the target language is right-to-left (RTL)
- **RTL languages supported**: Hebrew (he), Arabic (ar), Persian (fa), Urdu (ur)
- **Webview enhancements**: Updated the webview to apply proper RTL styling

### How it works:

When a Markdown file is opened, the extension:
1. Checks the target language from settings
2. Determines if it's an RTL language
3. Applies appropriate styling:
   - Sets `direction: rtl` on the HTML body
   - Sets `text-align: right` for all text
   - Adjusts the overall layout for RTL reading

### Code Changes:

```typescript
// In src/extension.ts
const isRTL = ['he', 'ar', 'fa', 'ur'].includes(targetLang.toLowerCase());
panel.webview.html = getWebviewContent(translatedText, summary, isRTL);
```

```html
<!-- In getWebviewContent() -->
<html lang="${isRTL ? 'he' : 'en'}" dir="${dir}">
<body style="text-align: ${textAlign}; direction: ${dir}">
```

## 2. Enhanced AI Service Configuration

### New Configuration Options:

1. **Service Selection**: Combo box to choose from multiple AI services
   - OpenAI (default)
   - Anthropic
   - Google Gemini
   - Custom API endpoint

2. **Model Selection**: Combo box to select specific model for each service
3. **API Key Input**: Secure configuration for API keys
4. **Custom API Endpoint**: Support for custom OpenAI-compatible API endpoints
5. **Temperature Control**: Fine-grained control over AI response creativity

### Configuration Structure in package.json:

```json
{
  "md-translator.service": {
    "type": "string",
    "default": "openai",
    "description": "AI service to use: openai, anthropic, gemini, or custom."
  },
  "md-translator.model": {
    "type": "string",
    "default": "gpt-4o-mini",
    "description": "Model to use for translation and summarization."
  },
  "md-translator.apiKey": {
    "type": "string",
    "default": "",
    "description": "API key for the selected AI service."
  },
  "md-translator.customApiEndpoint": {
    "type": "string",
    "default": "",
    "description": "Custom API endpoint for the 'custom' service option."
  },
  "md-translator.customModelName": {
    "type": "string",
    "default": "",
    "description": "Model name for the custom API endpoint."
  },
  "md-translator.temperature": {
    "type": "number",
    "default": 0.1,
    "description": "Temperature setting for AI responses (0-2)."
  }
}
```

## 3. OpenAI-Compatible API Support

### OpenAI API Implementation:

```typescript
async function translateWithOpenAI(
    text: string,
    targetLang: string,
    summaryLength: string,
    model: string,
    apiKey: string,
    temperature: number
): Promise<TranslationResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            temperature: temperature,
            messages: [
                {
                    role: 'system',
                    content: `You are a professional translator and summarizer.`
                },
                {
                    role: 'user',
                    content: text
                }
            ]
        })
    });
    // Process response...
}
```

### Anthropic API Support:

```typescript
async function translateWithAnthropic(
    text: string,
    targetLang: string,
    summaryLength: string,
    model: string,
    apiKey: string,
    temperature: number
): Promise<TranslationResult> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        // Request body...
    });
    // Process response...
}
```

### Google Gemini API Support:

```typescript
async function translateWithGemini(
    text: string,
    targetLang: string,
    summaryLength: string,
    model: string,
    apiKey: string,
    temperature: number
): Promise<TranslationResult> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Request body...
        }
    );
    // Process response...
}
```

### Custom API Support:

```typescript
async function translateWithCustomAPI(
    text: string,
    targetLang: string,
    summaryLength: string,
    apiEndpoint: string,
    modelName: string,
    apiKey: string,
    temperature: number
): Promise<TranslationResult> {
    const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        // OpenAI-compatible request body...
    });
    // Process response...
}
```

## 4. Error Handling Improvements

### Enhanced Error Messages:

- **API key validation**: Checks if API key is provided before calling services
- **Service-specific errors**: Detailed error messages for each service
- **Network errors**: Handles HTTP errors and connection issues
- **Response parsing**: Handles cases where AI responses are not valid JSON
- **API endpoint validation**: Checks custom API endpoints

### Error Response Structure:

```typescript
return {
    translatedText: `[[Error translating with ${service}]]\n\n${text}`,
    summary: `• Error: ${(error as Error).message}\n• Check API key and network connection`
};
```

## 5. Updated Defaults

- **Default service**: Changed from Google Translate to OpenAI
- **Default model**: GPT-4o-mini (cost-effective and high quality)
- **Default language**: Still Hebrew (he)
- **Default temperature**: 0.1 (for consistent, factual responses)

## 6. Usage Instructions

### Basic Configuration:

1. Open VS Code/Google Antigravity settings (Ctrl+,)
2. Search for "Markdown Translator"
3. Configure:
   - Target language (e.g., 'he', 'ar', 'en', 'fr')
   - AI service (openai, anthropic, gemini, custom)
   - Model (specific model name)
   - API key (for selected service)
   - Temperature (0.0 to 2.0)

### Custom API Configuration:

For custom OpenAI-compatible APIs (e.g., local LLMs, cloud-hosted models):

1. Set `service` to "custom"
2. Set `customApiEndpoint` to your API URL (e.g., "http://localhost:1234/v1/chat/completions")
3. Set `customModelName` to your model name (e.g., "llama-3.1-8b-instruct")
4. Set `apiKey` if your API requires authentication

## 7. Compatibility

- **VS Code version**: ^1.95.0
- **Node.js version**: 16.x or higher
- **Google Antigravity**: Fully compatible
- **Operating systems**: Windows, macOS, Linux

## 8. Performance Improvements

- **Single API call**: Combined translation and summarization in one request
- **Error recovery**: Graceful handling of API failures
- **Resource management**: Proper error boundaries and fallback mechanisms

## Upgrade from Version 0.0.1

1. Uninstall the old version
2. Install the new VSIX file (md-translator-0.1.0.vsix)
3. Reconfigure your settings if needed
4. Test with a Markdown file

## Future Enhancements

Potential future features:
- UI for selecting models from predefined lists
- Support for more AI services
- Batch processing of multiple files
- Custom prompt templates
- Translation history
- Markdown rendering with syntax highlighting

## Support

For issues, suggestions, or questions:
1. Check the README.md file
2. Open an issue on GitHub
3. Contact the maintainer