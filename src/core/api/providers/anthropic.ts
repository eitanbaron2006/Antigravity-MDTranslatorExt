import { ApiHandler, ModelInfo, ApiConfiguration } from '../index';

export class AnthropicHandler implements ApiHandler {
    private config: ApiConfiguration;

    constructor(config: ApiConfiguration) {
        this.config = config;
    }

    async createMessage(systemPrompt: string, messages: any[]): Promise<any> {
        const apiKey = this.config.apiKey;
        const modelId = this.config.apiModel || 'claude-3-5-sonnet-20240620';

        if (!apiKey) {
            throw new Error('Anthropic API key not configured');
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: modelId,
                max_tokens: 4096,
                system: systemPrompt,
                messages: messages.map(m => ({ role: m.role, content: m.content }))
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Anthropic Error: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json() as any;
        const textContent = data.content?.[0]?.text || '{}';

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
            id: this.config.apiModel || 'claude-3-5-sonnet-20240620',
            info: {
                id: this.config.apiModel || 'claude-3-5-sonnet-20240620',
                supportsImages: true,
                supportsTools: true,
                supportsPromptCache: true
            }
        };
    }
}
