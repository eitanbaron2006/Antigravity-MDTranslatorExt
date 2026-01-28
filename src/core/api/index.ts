import * as vscode from 'vscode';

export type ModelInfo = {
    id: string;
    description?: string;
    maxTokens?: number;
    contextWindow?: number;
    supportsImages?: boolean;
    supportsTools?: boolean;
    supportsPromptCache?: boolean;
};

export type ApiConfiguration = {
    apiProvider?: string;
    apiModel?: string;
    apiKey?: string;
    customUrl?: string;
};

export interface ApiHandler {
    createMessage(systemPrompt: string, messages: any[]): Promise<any>;
    getModel(): { id: string; info: ModelInfo };
}

import { GeminiHandler } from './providers/gemini';
import { AnthropicHandler } from './providers/anthropic';
import { OpenAiHandler } from './providers/openai';

export function createHandler(config: ApiConfiguration): ApiHandler {
    switch (config.apiProvider) {
        case 'Gemini':
            return new GeminiHandler(config);
        case 'Anthropic':
            return new AnthropicHandler(config);
        case 'OpenAI':
        case 'DeepSeek':
        case 'Custom':
            return new OpenAiHandler(config);
        default:
            throw new Error(`Provider ${config.apiProvider} not implemented`);
    }
}
