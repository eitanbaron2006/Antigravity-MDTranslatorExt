import * as vscode from 'vscode';
import { DEFAULT_SKILLS } from './DefaultSkills';
import { createHandler } from './core/api';

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

    public updateConfig(config: any) {
        // The configurations are stored in VS Code settings.
        // This method serves as a trigger point if we needed to clear internal caches.
        // Since getSettings() reads directly from VS Code config, we are good.
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
        const result = await this.callAiApi('', [{ role: 'user', content: prompt }], settings);
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

        const result = await this.callAiApi('', [{ role: 'user', content: prompt }], settings);
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

        const result = await this.callAiApi('', [{ role: 'user', content: prompt }], settings);
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

        const result = await this.callAiApi('', [{ role: 'user', content: prompt }], settings);
        return result.code || text;
    }

    async callAgenticApi(systemPrompt: string, messages: any[], tools: any[]): Promise<any> {
        const settings = this.getSettings();
        const projectSkills = await this.getProjectSkills();

        const fullSystemPrompt = `
${systemPrompt}

---
ADDITIONAL CONTEXT & STANDARDS:
${settings.devSystemPrompt ? `\nGLOBAL INSTRUCTIONS:\n${settings.devSystemPrompt}\n` : ''}${projectSkills}

CRITICAL: You are an agent designed for tool-use. 
Respond in JSON format with:
- "thought": Your internal reasoning or next steps (in ${settings.language}).
- "toolCalls": Array of { "name": string, "args": object } if you need to use tools.
- "content": Your final response to the user if no more tools are needed (in ${settings.language}).

Available Tools:
${JSON.stringify(tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })), null, 2)}
`;

        return await this.callAiApi(fullSystemPrompt, messages, settings);
    }

    private async callAiApi(systemPrompt: string, messages: any[], settings?: any): Promise<any> {
        if (!settings) settings = this.getSettings();

        const handler = createHandler({
            apiProvider: settings.aiProvider,
            apiModel: settings.aiModel,
            apiKey: settings.apiKey,
            customUrl: settings.customUrl
        });

        const response = await handler.createMessage(systemPrompt, messages);

        // If it's already an object, return it. If it's a string, try to parse it.
        if (typeof response === 'object' && response !== null) {
            return response;
        }

        return this.extractJson(String(response));
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
