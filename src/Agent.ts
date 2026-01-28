import * as vscode from 'vscode';
import { AiService } from './AiService';
import { TOOLS } from './Tools';

export interface AgentMessage {
    role: 'user' | 'assistant' | 'tool' | 'thought';
    content: string;
    toolCall?: {
        name: string;
        args: any;
        callId?: string;
    };
    toolResult?: {
        callId?: string;
        result: string;
    };
    requiresApproval?: boolean;
}

export class Agent {
    private aiService: AiService;
    private onUpdate: (data: any) => void;
    private messages: any[] = [];
    private isRunning: boolean = false;
    private approvalResolver: ((granted: boolean) => void) | null = null;

    constructor(aiService: AiService, onUpdate: (data: any) => void) {
        this.aiService = aiService;
        this.onUpdate = onUpdate;
    }

    public resolveApproval(granted: boolean) {
        if (this.approvalResolver) {
            this.approvalResolver(granted);
            this.approvalResolver = null;
        }
    }

    public resetSession() {
        this.messages = [];
        this.isRunning = false;
        this.approvalResolver = null;
    }

    public updateConfig(config: any) {
        this.aiService.updateConfig(config);
    }

    public async executeTask(text: string, mode: string = 'Code') {
        if (this.isRunning) return;
        this.isRunning = true;

        const userMessage = { role: 'user', content: text };
        this.messages.push(userMessage);
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
        const maxIterations = 15;

        while (iterations < maxIterations) {
            iterations++;

            const systemPrompt = this.getSystemPrompt(mode);

            try {
                this.onUpdate({ type: 'setThinking', value: true });
                const response = await this.aiService.callAgenticApi(systemPrompt, this.messages, TOOLS);
                this.onUpdate({ type: 'setThinking', value: false });

                if (response.thought) {
                    const hasTools = response.toolCalls && response.toolCalls.length > 0;
                    const isDifferent = response.thought.trim() !== (response.content || '').trim();

                    if (isDifferent || hasTools) {
                        this.onUpdate({ role: 'thought', content: response.thought });
                        // Add thought as an assistant message for context in the next turn
                        this.messages.push({ role: 'assistant', content: `[Thought] ${response.thought}` });
                    }
                }

                if (response.toolCalls && response.toolCalls.length > 0) {
                    for (const tc of response.toolCalls) {
                        const dangerousTools = ['run_command', 'write_to_file', 'apply_diff'];
                        const needsApproval = dangerousTools.includes(tc.name);

                        if (needsApproval) {
                            this.onUpdate({
                                role: 'assistant',
                                content: `Aion wants to use **${tc.name}**. Do you approve?`,
                                toolCall: tc,
                                requiresApproval: true
                            });

                            const granted = await new Promise<boolean>((resolve) => {
                                this.approvalResolver = resolve;
                            });

                            if (!granted) {
                                const toolResultMsg = { role: 'user', content: `Tool ${tc.name} execution rejected by user.` };
                                this.messages.push(toolResultMsg);
                                this.onUpdate({ role: 'tool', content: { name: tc.name, arguments: tc.args, result: 'Rejected by user' } });
                                continue;
                            }
                        }

                        const result = await this.executeTool(tc.name, tc.args);
                        this.onUpdate({ role: 'tool', content: { name: tc.name, arguments: tc.args, result } });

                        // Properly log the tool call and result in history
                        this.messages.push({ role: 'assistant', content: `I will use tool: ${tc.name}(${JSON.stringify(tc.args)})` });
                        this.messages.push({ role: 'user', content: `Tool Result: ${result}` });
                    }
                    // Loop continues automatically to process tool results
                } else if (response.content) {
                    this.onUpdate({ role: 'assistant', content: response.content });
                    this.messages.push({ role: 'assistant', content: response.content });
                    break;
                } else {
                    // If we got here, it means we have neither tools nor content
                    console.error('Empty AI response:', response);
                    throw new Error('The AI returned an empty response. This might be due to a parsing error or context window limits.');
                }
            } catch (err: any) {
                console.error('Agent Loop Error:', err);
                this.onUpdate({ role: 'assistant', content: `Execution Error: ${err.message}` });
                break;
            }
        }
    }

    private getSystemPrompt(mode: string): string {
        return `You are Aion, an advanced autonomous coding agent. 
Follow the user's instructions carefully.

### CORE PRINCIPLES:
1. **Be Concise**: If the user just says "Hi", respond naturally without using tools.
2. **Context First**: Don't guess. Use tools like 'list_files_recursive' only if you need to know about the project to answer.
3. **Reasoning**: Use the 'thought' field for your logic. Don't repeat it in 'content'.
4. **Tool Use**: You MUST only use tools when necessary. If the user's task is completed, provide the final answer in 'content'.

### CURRENT MODE: ${mode}
${this.getModeInstructions(mode)}
`;
    }

    private getModeInstructions(mode: string): string {
        const modes: Record<string, string> = {
            'Architect': "Focus on high-level design and structural changes.",
            'Code': "Focus on implementation, refactoring, and clean code.",
            'Ask': "Focus on gathering information and explaining technical concepts.",
            'Debug': "Focus on finding root causes and fixing bugs.",
        };
        return modes[mode] || "Act as a general-purpose coding assistant.";
    }

    private async executeTool(name: string, args: any): Promise<string> {
        try {
            const tool = TOOLS.find(t => t.name === name);
            if (!tool) return `Error: Tool ${name} not found`;
            // Standardizing arguments passing
            return await tool.execute(args || {});
        } catch (err: any) {
            return `Error executing tool ${name}: ${err.message}`;
        }
    }
}
