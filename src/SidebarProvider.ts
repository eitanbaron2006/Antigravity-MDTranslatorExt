import * as vscode from 'vscode';
import { AiService } from './AiService';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aion-chat';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _aiService: AiService
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage': {
                    await this._handleChat(data.value);
                    break;
                }
            }
        });
    }

    private async _handleChat(text: string) {
        if (!this._view) return;

        // Add user message to UI
        this._view.webview.postMessage({ type: 'addMessage', role: 'user', text });

        try {
            // Simplified agent for initial version
            // In the future, this will handle multi-step tool calls
            const response = await this._aiService.upgradeCode("", `Respond as a helpful AI assistant named Aion. User says: ${text}`);
            this._view.webview.postMessage({ type: 'addMessage', role: 'assistant', text: response });
        } catch (err) {
            this._view.webview.postMessage({ type: 'addMessage', role: 'assistant', text: 'Error communicating with AI.' });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                        font-family: var(--vscode-font-family, sans-serif);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-sideBar-background);
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                    }
                    .chat-container {
                        flex-grow: 1;
                        overflow-y: auto;
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    .message {
                        padding: 8px 12px;
                        border-radius: 8px;
                        max-width: 90%;
                        font-size: 13px;
                    }
                    .user {
                        align-self: flex-end;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    .assistant {
                        align-self: flex-start;
                        background-color: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .input-area {
                        padding: 10px;
                        background-color: var(--vscode-sideBar-background);
                        border-top: 1px solid var(--vscode-panel-border);
                        display: flex;
                        gap: 8px;
                    }
                    textarea {
                        flex-grow: 1;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                        padding: 8px;
                        resize: none;
                        outline: none;
                        font-family: inherit;
                        height: 40px;
                    }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 0 15px;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="chat-container" id="chat">
                    <div class="message assistant">Hello! I am Aion, your AI coding agent. How can I help you today?</div>
                </div>
                <div class="input-area">
                    <textarea id="msg" placeholder="Ask me something..."></textarea>
                    <button onclick="send()">Send</button>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const chat = document.getElementById('chat');
                    const msg = document.getElementById('msg');

                    function send() {
                        const text = msg.value.trim();
                        if (text) {
                            vscode.postMessage({ type: 'sendMessage', value: text });
                            msg.value = '';
                        }
                    }

                    window.addEventListener('message', event => {
                        const data = event.data;
                        if (data.type === 'addMessage') {
                            const div = document.createElement('div');
                            div.className = 'message ' + data.role;
                            div.textContent = data.text;
                            chat.appendChild(div);
                            chat.scrollTop = chat.scrollHeight;
                        }
                    });

                    msg.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}
