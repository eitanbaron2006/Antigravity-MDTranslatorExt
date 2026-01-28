import { ApiHandler, ModelInfo, ApiConfiguration } from '../index';

export class GeminiHandler implements ApiHandler {
    private config: ApiConfiguration;

    constructor(config: ApiConfiguration) {
        this.config = config;
    }

    async createMessage(systemPrompt: string, messages: any[]): Promise<any> {
        const apiKey = this.config.apiKey;
        const modelId = this.config.apiModel || 'gemini-2.0-flash';

        if (!apiKey) {
            throw new Error('Gemini API key not configured');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        // Combine system prompt and messages for Gemini
        const contents = [
            { role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}` }] },
            ...messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }))
        ];

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini Error: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json() as any;
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        try {
            return JSON.parse(textContent);
        } catch (e) {
            const match = textContent.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
            return { content: textContent };
        }
    }

    getModel(): { id: string; info: ModelInfo } {
        return {
            id: this.config.apiModel || 'gemini-2.0-flash',
            info: {
                id: this.config.apiModel || 'gemini-2.0-flash',
                supportsImages: true,
                supportsTools: true,
                supportsPromptCache: true
            }
        };
    }
}
