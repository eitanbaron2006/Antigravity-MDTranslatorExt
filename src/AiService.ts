import * as vscode from 'vscode';
import { DEFAULT_SKILLS } from './DefaultSkills';

export class AiService {
    private getSettings() {
        const config = vscode.workspace.getConfiguration('aion');
        return {
            language: config.get<string>('language') || 'en',
            summaryLength: config.get<string>('summaryLength') || 'medium',
            aiProvider: config.get<string>('aiProvider') || 'Gemini',
            aiModel: config.get<string>('aiModel') || '',
            customUrl: config.get<string>('customUrl') || '',
            apiKey: config.get<string>('apiKey') || '',
            devLang: config.get<string>('devLang') || 'vanilla js',
            devSystemPrompt: config.get<string>('devSystemPrompt') || '',
            useProjectSkills: config.get<boolean>('useProjectSkills') !== false
        };
    }

    private async getProjectSkills(): Promise<string> {
        const settings = this.getSettings();
        if (!settings.useProjectSkills) return '';

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return '';

        let skillContent = '';
        for (const folder of workspaceFolders) {
            // Search for SKILL.md in .agent/skills relative to workspace
            const pattern = new vscode.RelativePattern(folder, '.agent/skills/**/SKILL.md');
            const files = await vscode.workspace.findFiles(pattern);

            for (const file of files) {
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    const text = Buffer.from(content).toString('utf8');
                    const skillName = file.fsPath.split(/[\\/]/).slice(-2, -1)[0] || 'Unknown Skill';
                    skillContent += `\n--- PROJECT SKILL: ${skillName} ---\n${text}\n`;
                } catch (e) { /* ignore */ }
            }
        }

        return (skillContent ? `\n\nPROJECT-SPECIFIC SKILLS & INSTRUCTIONS:\n${skillContent}` : '') + `\n\nPROFESSIONAL BASELINE STANDARDS:\n${DEFAULT_SKILLS}`;
    }

    async translateAndSummarize(text: string): Promise<{ translatedText: string; summary: string }> {
        const settings = this.getSettings();
        const prompt = this.buildTranslationPrompt(text, settings);
        const result = await this.callAiApi(prompt, settings);
        return { translatedText: result.translation || text, summary: result.summary || '' };
    }

    async getRecommendations(text: string): Promise<any[]> {
        const settings = this.getSettings();
        const projectSkills = await this.getProjectSkills();
        const prompt = `You are a professional software architect. 
Analyze the provided code and suggest specific, high-quality improvements.
The target stack/language is: ${settings.devLang}.
${settings.devSystemPrompt ? `\nGLOBAL INSTRUCTIONS:\n${settings.devSystemPrompt}\n` : ''}${projectSkills}
CRITICAL: All explanations, reviews, and reasons MUST be in ${settings.language}.
Return a JSON object with a "recommendations" field which is an array of objects.
Each object MUST have:
- "title": Short description of the improvement (in ${settings.language}).
- "reason": Why this change is beneficial (in ${settings.language}).
- "before": The exact block of code to replace.
- "after": The improved code block.

Return ONLY the JSON.

Code to analyze:
${text}`;

        const result = await this.callAiApi(prompt, settings);
        return result.recommendations || [];
    }

    async generateCode(description: string): Promise<{ code: string; suggestedFilename: string }> {
        const settings = this.getSettings();
        const projectSkills = await this.getProjectSkills();
        const prompt = `You are an expert coder. 
Build a solution for the following description using ${settings.devLang}.
${settings.devSystemPrompt ? `\nGLOBAL INSTRUCTIONS:\n${settings.devSystemPrompt}\n` : ''}${projectSkills}
Return a JSON object with:
- "code": The full implementation code.
- "suggestedFilename": A professional filename with the correct extension for this implementation.

Description:
${description}`;

        const result = await this.callAiApi(prompt, settings);
        return {
            code: result.code || '// No code generated',
            suggestedFilename: result.suggestedFilename || 'generated_code.txt'
        };
    }

    async upgradeCode(text: string, userPrompt: string): Promise<string> {
        const settings = this.getSettings();
        const projectSkills = await this.getProjectSkills();
        const prompt = `You are an expert developer. 
Improve and upgrade the following code based on these instructions: ${userPrompt || 'Make it cleaner, more efficient, and professional'}.
The target stack/language is: ${settings.devLang}.
${settings.devSystemPrompt ? `\nGLOBAL INSTRUCTIONS:\n${settings.devSystemPrompt}\n` : ''}${projectSkills}
Return a JSON object with a "code" field containing the full upgraded implemention.

Original Code:
${text}`;

        const result = await this.callAiApi(prompt, settings);
        return result.code || text;
    }

    async callAgenticApi(prompt: string, tools: any[]): Promise<any> {
        const settings = this.getSettings();
        const projectSkills = await this.getProjectSkills();

        const enhancedPrompt = `
${prompt}

---
ADDITIONAL CONTEXT & STANDARDS:
${settings.devSystemPrompt ? `\nGLOBAL INSTRUCTIONS:\n${settings.devSystemPrompt}\n` : ''}${projectSkills}

CRITICAL: You are an agent designed for tool-use. 
Respond in JSON format with:
- "thought": Your internal reasoning or next steps (in ${settings.language}).
- "toolCalls": Array of { "name": string, "args": object, "callId": string } if you need to use tools.
- "content": Your final response to the user if no more tools are needed (in ${settings.language}).

Available Tools:
${JSON.stringify(tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })), null, 2)}
`;

        return await this.callAiApiForAgent(enhancedPrompt, settings);
    }

    private async callAiApiForAgent(prompt: string, settings: any): Promise<any> {
        // We reuse the existing callAiApi logic but ensure it handles the agentic prompt
        // and returns the structured JSON.
        const result = await this.callAiApi(prompt, settings);
        return result;
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
