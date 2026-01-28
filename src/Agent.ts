import * as vscode from 'vscode';
import { AiService } from './AiService';
import { TOOLS, Tool } from './Tools';

export interface AgentMessage {
    role: 'user' | 'assistant' | 'tool' | 'thought';
    content: string;
    toolCall?: {
        name: string;
        args: any;
        callId: string;
    };
    toolResult?: {
        callId: string;
        result: string;
    };
}

export class Agent {
    private messages: AgentMessage[] = [];
    private isRunning: boolean = false;

    constructor(
        private readonly aiService: AiService,
        private readonly onUpdate: (message: AgentMessage) => void
    ) { }

    public async handleUserMessage(text: string, mode: string) {
        if (this.isRunning) return;
        this.isRunning = true;

        this.messages.push({ role: 'user', content: text });
        this.onUpdate({ role: 'user', content: text });

        try {
            await this.runLoop(mode);
        } catch (err: any) {
            this.onUpdate({ role: 'assistant', content: `Error: ${err.message}` });
        } finally {
            this.isRunning = false;
        }
    }

    private async runLoop(mode: string) {
        let iterations = 0;
        const maxIterations = 10;

        while (iterations < maxIterations) {
            iterations++;

            const systemPrompt = this.getSystemPrompt(mode);
            const promptWithHistory = this.buildPrompt(systemPrompt);

            // Note: AiService.callAiApi needs to be updated to support tool definitions and multi-turn properly.
            // For this phase, we simulate the logic or assume AiService handles the raw call.
            const response = await this.aiService.callAgenticApi(promptWithHistory, TOOLS);

            if (response.thought) {
                this.onUpdate({ role: 'thought', content: response.thought });
                this.messages.push({ role: 'thought', content: response.thought });
            }

            if (response.toolCalls && response.toolCalls.length > 0) {
                for (const tc of response.toolCalls) {
                    this.onUpdate({ role: 'assistant', content: `Executing tool: ${tc.name}...`, toolCall: tc });
                    const tool = TOOLS.find(t => t.name === tc.name);
                    let result = '';
                    if (tool) {
                        result = await tool.execute(tc.args);
                    } else {
                        result = `Error: Tool ${tc.name} not found.`;
                    }

                    const toolMessage: AgentMessage = {
                        role: 'tool',
                        content: result,
                        toolResult: { callId: tc.callId, result }
                    };
                    this.messages.push(toolMessage);
                    this.onUpdate(toolMessage);
                }
                // Continue loop to let agent process tool results
            } else if (response.content) {
                this.onUpdate({ role: 'assistant', content: response.content });
                this.messages.push({ role: 'assistant', content: response.content });
                break; // Interaction finished
            } else {
                break;
            }
        }
    }

    private getSystemPrompt(mode: string): string {
        const base = "You are Aion, an expert AI agent. You have access to tools to interact with the workspace.";
        const modes: Record<string, string> = {
            'Architect': "Focus on high-level design and planning. Request information before acting.",
            'Code': "Focus on writing and refactoring code efficiently.",
            'Ask': "Provide clear explanations and answers to user questions.",
            'Debug': "Analyze errors and logs to find root causes and fix them.",
            'Orchestrator': "Coordinate complex tasks that might involve multiple steps or modes.",
            'Review': "Critically evaluate code changes for quality and security."
        };
        return `${base}\nCurrent Mode: ${mode}\n${modes[mode] || ''}`;
    }

    private buildPrompt(systemPrompt: string): string {
        // Simple serialization of history for now. 
        // In a real implementation, this would be passed as a structured message array to the LLM API.
        return `SYSTEM: ${systemPrompt}\n\n` +
            this.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    }
}
