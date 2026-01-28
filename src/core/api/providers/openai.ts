import { ApiHandler, ModelInfo, ApiConfiguration } from '../index';

export class OpenAiHandler implements ApiHandler {
    private config: ApiConfiguration;

    constructor(config: ApiConfiguration) {
        this.config = config;
    }

    async createMessage(systemPrompt: string, messages: any[]): Promise<any> {
        const apiKey = this.config.apiKey;
        const provider = this.config.apiProvider;
        const modelId = this.config.apiModel || (provider === 'DeepSeek' ? 'deepseek-chat' : 'gpt-4o');

        let baseUrl = '';
        if (provider === 'OpenAI') baseUrl = 'https://api.openai.com/v1/chat/completions';
        else if (provider === 'DeepSeek') baseUrl = 'https://api.deepseek.com/chat/completions';
        else if (provider === 'Custom') {
            const customUrl = this.config.customUrl || '';
            baseUrl = customUrl.includes('/chat/completions') ? customUrl : (customUrl.endsWith('/') ? customUrl + 'chat/completions' : customUrl + '/chat/completions');
        }

        if (!apiKey && provider !== 'Custom') {
            throw new Error(`${provider} API key not configured`);
        }

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelId,
                response_format: { type: "json_object" },
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages.map(m => ({ role: m.role, content: m.content }))
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`${provider} Error: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json() as any;
        const textContent = data.choices?.[0]?.message?.content || '{}';

        try {
            return JSON.parse(textContent);
        } catch (e) {
            const match = textContent.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
            return { content: textContent };
        }
    }

    getModel(): { id: string; info: ModelInfo } {
        const provider = this.config.apiProvider;
        const modelId = this.config.apiModel || (provider === 'DeepSeek' ? 'deepseek-chat' : 'gpt-4o');
        return {
            id: modelId,
            info: {
                id: modelId,
                supportsImages: true,
                supportsTools: true,
                supportsPromptCache: provider === 'DeepSeek'
            }
        };
    }
}
