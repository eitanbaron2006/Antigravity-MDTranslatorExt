import * as vscode from 'vscode';

export class AiService {
    private getSettings() {
        const config = vscode.workspace.getConfiguration('md-translator');
        return {
            language: config.get<string>('language') || 'en',
            summaryLength: config.get<string>('summaryLength') || 'medium',
            aiProvider: config.get<string>('aiProvider') || 'Gemini',
            aiModel: config.get<string>('aiModel') || '',
            customUrl: config.get<string>('customUrl') || '',
            apiKey: config.get<string>('apiKey') || '',
            devLang: config.get<string>('devLang') || 'vanilla js'
        };
    }

    async translateAndSummarize(text: string): Promise<{ translatedText: string; summary: string }> {
        const settings = this.getSettings();
        const prompt = this.buildTranslationPrompt(text, settings);
        const result = await this.callAiApi(prompt, settings);
        return { translatedText: result.translation || text, summary: result.summary || '' };
    }

    async getRecommendations(text: string): Promise<any[]> {
        const settings = this.getSettings();
        const prompt = `You are a professional software architect. 
Analyze the provided code and suggest specific, high-quality improvements.
The target stack/language is: ${settings.devLang}.
Return a JSON object with a "recommendations" field which is an array of objects.
Each object MUST have:
- "title": Short description of the improvement.
- "reason": Why this change is beneficial.
- "before": The exact block of code to replace.
- "after": The improved code block.

Return ONLY the JSON.

Code to analyze:
${text}`;

        const result = await this.callAiApi(prompt, settings);
        return result.recommendations || [];
    }

    async generateCode(description: string): Promise<string> {
        const settings = this.getSettings();
        const prompt = `You are an expert coder. 
Build a solution for the following description using ${settings.devLang}.
Return a JSON object with a "code" field containing the full implementation.

Description:
${description}`;

        const result = await this.callAiApi(prompt, settings);
        return result.code || '// No code generated';
    }

    private async callAiApi(prompt: string, settings: any): Promise<any> {
        const provider = settings.aiProvider;
        const apiKey = settings.apiKey;
        const model = settings.aiModel;
        const customUrl = settings.customUrl;

        if (!apiKey && provider !== 'Custom') {
            throw new Error(`API key for ${provider} not configured`);
        }

        const defaultModels: Record<string, string> = {
            'Gemini': 'gemini-2.0-flash',
            'OpenAI': 'gpt-4o',
            'Anthropic': 'claude-3-5-sonnet-20240620',
            'DeepSeek': 'deepseek-chat',
            'Custom': 'gpt-3.5-turbo'
        };

        const selectedModel = model && model.trim() !== '' ? model : defaultModels[provider];

        if (provider === 'Gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { response_mime_type: "application/json" }
                })
            });

            if (!response.ok) throw new Error(`Gemini Error: ${response.statusText}`);
            const data = await response.json() as any;
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            return this.extractJson(content);
        }

        if (provider === 'Anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: selectedModel,
                    max_tokens: 4096,
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            if (!response.ok) throw new Error(`Anthropic Error: ${response.statusText}`);
            const data = await response.json() as any;
            // Try to extract JSON from text if it's not strictly JSON
            const content = data.content?.[0]?.text || '';
            return this.extractJson(content);
        }

        // OpenAI-compatible
        let baseUrl = '';
        if (provider === 'OpenAI') baseUrl = 'https://api.openai.com/v1/chat/completions';
        else if (provider === 'DeepSeek') baseUrl = 'https://api.deepseek.com/chat/completions';
        else if (provider === 'Custom') baseUrl = customUrl.includes('/chat/completions') ? customUrl : (customUrl.endsWith('/') ? customUrl + 'chat/completions' : customUrl + '/chat/completions');

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: selectedModel,
                response_format: { type: "json_object" },
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) throw new Error(`${provider} Error: ${response.statusText}`);
        const data = await response.json() as any;
        const content = data.choices?.[0]?.message?.content || '{}';
        return this.extractJson(content);
    }

    private buildTranslationPrompt(text: string, settings: any): string {
        return `You are a professional translator and summarizer. 
Translate the provided content into ${settings.language}.
Also generate a ${settings.summaryLength} summary in ${settings.language}.
Return a JSON object with strictly these fields: "translation" (string) and "summary" (string).

Content:
${text}`;
    }

    private extractJson(text: string): any {
        try {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
            return JSON.parse(text);
        } catch (e) {
            return {};
        }
    }
}
