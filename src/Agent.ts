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
    requiresApproval?: boolean;
}

export class Agent {
    private messages: AgentMessage[] = [];
    private isRunning: boolean = false;
    private approvalResolver: ((granted: boolean) => void) | null = null;

    constructor(
        private readonly aiService: AiService,
        private readonly onUpdate: (message: AgentMessage | { type: 'setThinking', value: boolean }) => void
    ) { }

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

    public updateConfig(config: { provider: string, key: string, model: string, url: string }) {
        this.aiService.updateConfig(config);
    }

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
        const maxIterations = 15; // Increased for more complex tasks

        while (iterations < maxIterations) {
            iterations++;

            const systemPrompt = this.getSystemPrompt(mode);
            const promptWithHistory = this.buildPrompt(systemPrompt);

            try {
                this.onUpdate({ type: 'setThinking', value: true });
                const response = await this.aiService.callAgenticApi(promptWithHistory, TOOLS);
                this.onUpdate({ type: 'setThinking', value: false });

                if (response.thought) {
                    this.onUpdate({ role: 'thought', content: response.thought });
                    this.messages.push({ role: 'thought', content: response.thought });
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
                                const toolMessage: AgentMessage = {
                                    role: 'tool',
                                    content: 'Error: User rejected the tool execution.',
                                    toolResult: { callId: tc.callId, result: 'Rejected by user.' }
                                };
                                this.messages.push(toolMessage);
                                this.onUpdate(toolMessage);
                                continue;
                            }
                        }

                        this.onUpdate({ role: 'assistant', content: `[Tool] ${tc.name}`, toolCall: tc });

                        const tool = TOOLS.find(t => t.name === tc.name);
                        let result = '';
                        if (tool) {
                            try {
                                result = await tool.execute(tc.args);
                            } catch (e: any) {
                                result = `Error executing tool ${tc.name}: ${e.message}`;
                            }
                        } else {
                            result = `Error: Tool "${tc.name}" is not recognized. Please check the tool definitions.`;
                        }

                        const toolMessage: AgentMessage = {
                            role: 'tool',
                            content: result,
                            toolResult: { callId: tc.callId, result }
                        };
                        this.messages.push(toolMessage);
                        this.onUpdate(toolMessage);
                    }
                    // Loop continues automatically to process tool results
                } else if (response.content) {
                    this.onUpdate({ role: 'assistant', content: response.content });
                    this.messages.push({ role: 'assistant', content: response.content });
                    break;
                } else {
                    // Fallback if AI returns empty but no tool calls
                    break;
                }
            } catch (err: any) {
                console.error('Agent Loop Error:', err);
                this.onUpdate({ role: 'assistant', content: `Execution Error: ${err.message}` });
                break;
            }
        }
    }

    private getSystemPrompt(mode: string): string {
        const constitution = `
You are Aion, an advanced autonomous coding agent. Your goal is to help the user with complex coding tasks by thinking, planning, and executing tools.

### CORE PRINCIPLES:
1. **Explore First**: Use 'list_files_recursive' and 'read_file' to understand the project structure and existing code before making changes.
2. **Plan Step-by-Step**: In your 'thought' field, outline what you've found and what you intend to do next.
3. **Be Precise**: When editing files, use 'apply_diff' for targeted changes or 'write_to_file' for new files.
4. **Verify Your Work**: Use 'run_command' (e.g., 'npm run compile', 'go test') to verify that your changes didn't break anything.
5. **Recover Gracefully**: If a tool fails or generates an error, analyze the output and try a different approach.

### CURRENT MODE: ${mode}
${this.getModeInstructions(mode)}

### RESPONSE FORMAT:
You MUST respond with a JSON object containing:
- "thought": A detailed explanation of your current state, what tools you are calling and why.
- "toolCalls": (Optional) An array of tool calls.
- "content": (Optional) Your direct response to the user when a task or sub-task is complete.
`;
        return constitution;
    }

    private getModeInstructions(mode: string): string {
        const modes: Record<string, string> = {
            'Architect': "You are in Architect mode. Focus on structural changes, high-level design, and system integration. Avoid writing large amounts of code until the design is approved.",
            'Code': "You are in Code mode. Focus on efficient implementation, refactoring, and following project patterns exactly. Write clean, idiomatic code.",
            'Ask': "You are in Ask mode. Focus on providing deep technical explanations and answering questions about the codebase. Use tools to gather facts before answering.",
            'Debug': "You are in Debug mode. Hunt for bugs, analyze logs, and fix identified issues. Use investigative tools to find root causes.",
            'Orchestrator': "You are in Orchestrator mode. Manage large-scale migrations or multi-component tasks. Delegate thinking to sub-steps.",
            'Review': "You are in Review mode. Critically analyze code for security, performance, and best practices. Cite specific lines in your feedback."
        };
        return modes[mode] || "Act as a general-purpose coding assistant.";
    }

    private buildPrompt(systemPrompt: string): string {
        // More robust message serialization
        let prompt = `System Constitution:\n${systemPrompt}\n\n`;

        // Add last 20 messages to prevent context overflow while keeping recent history
        const recentMessages = this.messages.slice(-20);

        for (const msg of recentMessages) {
            const role = msg.role.toUpperCase();
            if (msg.role === 'thought') {
                prompt += `[Thought]: ${msg.content}\n\n`;
            } else if (msg.role === 'tool') {
                prompt += `[Tool Result]: ${msg.content}\n\n`;
            } else if (msg.toolCall) {
                prompt += `[Assistant Tool Call]: ${msg.toolCall.name}(${JSON.stringify(msg.toolCall.args)})\n\n`;
            } else {
                prompt += `${role}: ${msg.content}\n\n`;
            }
        }

        return prompt;
    }
}
