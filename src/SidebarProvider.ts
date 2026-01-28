import * as vscode from 'vscode';
import { AiService } from './AiService';
import { Agent, AgentMessage } from './Agent';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aion-chat';
    private _view?: vscode.WebviewView;
    private _agent: Agent;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _aiService: AiService
    ) {
        this._agent = new Agent(this._aiService, (msg) => {
            if ('role' in msg) {
                this._postAgentMessage(msg);
            } else if ('type' in msg && msg.type === 'setThinking') {
                this._view?.webview.postMessage(msg);
            }
        });
    }

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
                    const { text, mode } = data.value;
                    await this._agent.executeTask(text, mode);
                    break;
                }
                case 'respondToPermission': {
                    const { granted } = data.value;
                    this._agent.resolveApproval(granted);
                    break;
                }
                case 'resetTask': {
                    this._agent.resetSession();
                    break;
                }
                case 'saveSettings': {
                    const { provider, key, model, url } = data.value;
                    const config = vscode.workspace.getConfiguration('aion');
                    await config.update('aiProvider', provider, vscode.ConfigurationTarget.Global);
                    await config.update('apiKey', key, vscode.ConfigurationTarget.Global);
                    await config.update('aiModel', model, vscode.ConfigurationTarget.Global);
                    await config.update('customUrl', url, vscode.ConfigurationTarget.Global);

                    // Refresh agent with new config
                    this._agent.updateConfig({ provider, key, model, url });

                    vscode.window.showInformationMessage('Aion settings updated successfully!');
                    break;
                }
            }
        });
    }

    private _postAgentMessage(message: AgentMessage) {
        if (!this._view) return;
        this._view.webview.postMessage({
            type: 'addMessage',
            role: message.role,
            text: message.content,
            toolCall: message.toolCall,
            toolResult: message.toolResult,
            requiresApproval: message.requiresApproval
        });
    }

    private async _handleChat(text: string) {
        // This is now handled via the Agent class
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.js'));
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'vscode.css'));
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'sidebar-icon.svg'));

        // Mock data for recent tasks
        const recentTasks = [
            { text: "google antigravity אני רוצה ליצור תוסף ל... ", date: "2 days ago" },
            { text: "Fix any issues in the following code from package.json:12-12", date: "2 days ago" }
        ];

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    :root {
                        --aion-primary: #3794ef;
                        --aion-card-bg: rgba(255, 255, 255, 0.03);
                        --aion-border: rgba(255, 255, 255, 0.1);
                        --aion-input-bg: #1e1e1e;
                    }
                    body {
                        padding: 0;
                        margin: 0;
                        font-family: var(--vscode-font-family, sans-serif);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-sideBar-background);
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        overflow: hidden;
                        box-sizing: border-box;
                    }
                    
                    #root {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        width: 100%;
                        position: relative;
                    }
                    
                    /* Settings View Overlay */
                    #settings-view {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: #1e1e1e;
                        z-index: 2000;
                        display: none;
                        flex-direction: column;
                        padding: 16px;
                        box-sizing: border-box;
                    }
                    #settings-view.show { display: flex; }
                    .settings-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 24px;
                    }
                    .settings-title { font-size: 18px; font-weight: 600; }
                    .setting-group { margin-bottom: 20px; }
                    .setting-label { display: block; font-size: 12px; font-weight: 600; color: #888; margin-bottom: 8px; }
                    .setting-input {
                        width: 100%;
                        background: #252526;
                        border: 1px solid var(--aion-border);
                        color: white;
                        padding: 8px;
                        border-radius: 4px;
                        font-size: 13px;
                    }
                    
                    /* Thinking Indicator */
                    .thinking {
                        display: none;
                        align-items: center;
                        gap: 8px;
                        font-size: 12px;
                        color: #888;
                        margin-top: 10px;
                        padding-left: 14px;
                    }
                    .thinking.show { display: flex; }
                    .spinner {
                        width: 14px;
                        height: 14px;
                        border: 2px solid rgba(255,255,255,0.1);
                        border-top-color: var(--aion-primary);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    
                    .content {
                        flex: 1;
                        overflow-y: auto;
                        padding: 16px 14px;
                        display: flex;
                        flex-direction: column;
                        gap: 20px;
                        scrollbar-width: thin;
                    }
                    
                    /* RTL Support */
                    .rtl {
                        direction: rtl;
                        text-align: right;
                    }
                    .ltr {
                        direction: ltr;
                        text-align: left;
                    }
                    
                    .view-container {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    
                    .hero {
                        text-align: center;
                        margin-top: 22px;
                        color: #fff;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 20px;
                        padding: 0px;
                    }
                    .hero-logo {
                        width: 80px;
                        height: 80px;
                        opacity: 0.9;
                    }
                    .hero-title {
                        font-size: 22px;
                        font-weight: 600;
                        color: #fff;
                        margin: 0;
                    }
                    .hero-subtitle {
                        font-size: 14px;
                        color: #ccc;
                        line-height: 1.5;
                        max-width: 240px;
                    }
                    .hero a {
                        color: var(--aion-primary);
                        text-decoration: none;
                    }

                    .section-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 10px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .section-header .view-all {
                        color: #888;
                        font-weight: 400;
                        cursor: pointer;
                    }

                    .task-card {
                        background: var(--aion-card-bg);
                        border: 1px solid var(--aion-border);
                        border-radius: 6px;
                        padding: 12px;
                        margin-bottom: 10px;
                        font-size: 13px;
                        position: relative;
                        transition: border-color 0.2s;
                    }
                    .task-card:hover {
                        border-color: rgba(255,255,255,0.2);
                    }
                    .task-text {
                        color: #ccc;
                        margin-bottom: 8px;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                    }
                    .task-footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        color: #666;
                        font-size: 11px;
                    }
                    .task-actions {
                        display: flex;
                        gap: 10px;
                    }
                    .task-actions svg {
                        width: 14px;
                        height: 14px;
                        cursor: pointer;
                    }
                    
                    /* Approval UI */
                    .approval-container {
                        margin-top: 12px;
                        display: flex;
                        gap: 8px;
                    }
                    .btn {
                        padding: 6px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 600;
                        cursor: pointer;
                        border: none;
                        transition: opacity 0.2s;
                    }
                    .btn:hover { opacity: 0.8; }
                    .btn-approve {
                        background: var(--aion-primary);
                        color: white;
                    }
                    .btn-reject {
                        background: rgba(255,255,255,0.1);
                        color: #ccc;
                    }

                    /* Input Area */
                    .footer {
                        padding: 10px 12px 4px 12px;
                        background: var(--vscode-sideBar-background);
                        z-index: 100;
                        margin-top: auto;
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .input-container {
                        background: var(--aion-input-bg);
                        border: 1px solid var(--vscode-focusBorder);
                        border-radius: 8px;
                        padding: 8px 8px 6px;
                    }
                    textarea {
                        width: 100%;
                        background: transparent;
                        border: none;
                        color: var(--vscode-input-foreground);
                        resize: none;
                        outline: none;
                        font-family: inherit;
                        font-size: 13px;
                        min-height: 72px;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    .input-footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 6px;
                    }
                    .input-actions {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .status-bar {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 11px;
                        color: #888;
                        padding: 0 4px;
                    }
                    .model-info {
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .status-actions {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .mode-selector {
                        position: relative;
                        display: flex;
                        align-items: center;
                    }
                    .pill {
                        background: rgba(255,255,255,0.08);
                        border-radius: 4px;
                        padding: 2px 8px;
                        font-size: 11px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: background 0.2s;
                    }
                    .pill:hover {
                        background: rgba(255,255,255,0.15);
                    }
                    .pill svg {
                        width: 12px;
                        height: 12px;
                    }
                    .icon-btn {
                        color: #888;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                    }
                    .icon-btn:hover {
                        color: #ccc;
                    }
                    
                    /* Dropdowns */
                    .dropdown {
                        position: absolute;
                        bottom: calc(100% + 6px);
                        left: 0;
                        background: #1e1e1e;
                        border: 1px solid #007acc;
                        border-radius: 6px;
                        width: 280px;
                        display: none;
                        flex-direction: column;
                        z-index: 1000;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    }
                    .dropdown.show {
                        display: flex;
                    }
                    .dropdown-search {
                        padding: 12px 10px 8px;
                    }
                    .dropdown-search input {
                        width: 100%;
                        background: #313132;
                        border: 1px solid #454545;
                        color: #cccccc;
                        padding: 6px 10px;
                        border-radius: 2px;
                        font-size: 13px;
                        box-sizing: border-box;
                        outline: none;
                    }
                    .dropdown-search input::placeholder {
                        color: #888;
                    }
                    .dropdown-search input:focus {
                        border-color: #007acc;
                    }
                    .dropdown-section-title {
                        padding: 8px 12px 4px;
                        font-size: 10px;
                        color: #888;
                        text-transform: uppercase;
                        font-weight: 700;
                    }
                    .dropdown-item {
                        padding: 10px 12px;
                        display: flex;
                        gap: 12px;
                        align-items: center;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    .dropdown-item:hover {
                        background: rgba(255,255,255,0.05);
                    }
                    .dropdown-item.active {
                        background: #043c5e;
                        color: #ffffff;
                    }
                    .dropdown-item.active .item-desc {
                        color: rgba(255,255,255,0.8);
                    }
                    .dropdown-item.active svg {
                        color: #ffffff;
                    }
                    .dropdown-item svg {
                        width: 16px;
                        height: 16px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .dropdown-item div {
                        display: flex;
                        flex-direction: column;
                        flex: 1;
                    }
                    .dropdown-item .item-desc {
                        font-size: 10px;
                        color: #888;
                    }
                    .dropdown-item .item-check {
                        margin-left: auto;
                        color: #ffffff;
                        display: none;
                    }
                    .dropdown-item.active .item-check {
                        display: block;
                    }
                    .dropdown-hint {
                        padding: 8px 12px;
                        font-size: 10px;
                        color: #666;
                        line-height: 1.4;
                        border-bottom: 1px solid var(--aion-border);
                    }
                    .dropdown-footer {
                        padding: 8px 12px;
                        border-top: 1px solid var(--aion-border);
                        font-size: 11px;
                        color: #888;
                        cursor: pointer;
                    }
                    .dropdown-footer:hover {
                        color: #ccc;
                    }

                    .status-bar {
                        padding: 4px 12px 8px 12px;
                        font-size: 11px;
                        color: #666;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                </style>
            </head>
            <body>
                <div id="root">
                    <div id="settings-view">
                        <div class="settings-header">
                            <span class="settings-title">Settings</span>
                            <div class="icon-btn" onclick="toggleSettings()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </div>
                        </div>
                        <div class="setting-group">
                            <label class="setting-label">AI Provider</label>
                            <input class="setting-input" type="text" id="setting-provider" placeholder="e.g., openai, anthropic">
                        </div>
                        <div class="setting-group">
                            <label class="setting-label">API Key</label>
                            <input class="setting-input" type="password" id="setting-key" placeholder="Enter your API key">
                        </div>
                        <div class="setting-group">
                            <label class="setting-label">Model</label>
                            <input class="setting-input" type="text" id="setting-model" placeholder="e.g., gpt-4, claude-3-opus">
                        </div>
                        <div class="setting-group">
                            <label class="setting-label">Custom URL (Optional)</label>
                            <input class="setting-input" type="text" id="setting-url" placeholder="https://api.example.com/v1">
                        </div>
                        <button class="btn btn-approve" style="width: 100%; margin-top: 10px;" onclick="saveSettings()">Save Settings</button>
                    </div>

                    <div class="view-container">
                        <div class="content" id="chat-content">
                            <div id="hero-view" class="hero">
                                <img src="${logoUri}" class="hero-logo" alt="Aion Logo">
                                <h2 class="hero-title">What can I do for you?</h2>
                                <div class="hero-subtitle">
                                    Ready to ship? The code won't write itself—not without me, anyway.
                                </div>
                                <div class="recent-tasks-area" style="text-align: left; width: 100%;">
                                    <div class="section-header">
                                        <span>Recent Tasks</span>
                                        <span class="view-all">View all</span>
                                    </div>
                                    ${recentTasks.map(task => `
                                        <div class="task-card">
                                            <div class="task-text">${task.text}</div>
                                            <div class="task-footer">
                                                <span>${task.date} ·</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            <div id="messages-container"></div>
                            <div class="thinking" id="thinking-indicator">
                                <div class="spinner"></div>
                                <span>Aion is thinking...</span>
                            </div>
                        </div>

                        <div class="footer">
                            <div id="new-task-container" style="display: none; padding: 0 12px 8px;">
                                <button class="btn btn-approve" style="width: 100%; background: #007acc;" onclick="startNewTask()">Start New Task</button>
                            </div>
                            
                            <div class="input-container">
                                <textarea id="msg" dir="auto" placeholder="Type your task here...
(@ to add context, / for commands, hold shift to drag in files)"></textarea>
                                
                                <div class="input-footer">
                                    <div class="mode-selector">
                                        <div class="pill" id="mode-trigger">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><polyline points="18 15 12 9 6 15"/></svg>
                                            <span id="active-mode">Code</span>
                                        </div>
                                        
                                        <!-- Mode Dropdown -->
                                        <div class="dropdown" id="mode-dropdown">
                                            <div class="dropdown-search"><input type="text" placeholder="Search..."></div>
                                            <div class="dropdown-hint">
                                                Ctrl + . for next mode, Ctrl + Shift + . for previous mode
                                            </div>
                                            <div class="dropdown-item" data-mode="Architect">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5M9 7l3 3 3-3M9 17l3-3 3 3M12 2v5"/></svg>
                                                <div>
                                                    <span>Architect</span>
                                                    <span class="item-desc">Plan and design before implementation</span>
                                                </div>
                                                <svg class="item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                                            </div>
                                            <div class="dropdown-item active" data-mode="Code">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                                                <div>
                                                    <span>Code</span>
                                                    <span class="item-desc">Write, modify, and refactor code</span>
                                                </div>
                                                <svg class="item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                                            </div>
                                            <div class="dropdown-item" data-mode="Ask">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                                <div>
                                                    <span>Ask</span>
                                                    <span class="item-desc">Get answers and explanations</span>
                                                </div>
                                                <svg class="item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                                            </div>
                                            <div class="dropdown-item" data-mode="Debug">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M16 2v4M3.5 7h17M10 12v4M14 12v4M3.5 17h17M8 18v4M16 18v4"/></svg>
                                                <div>
                                                    <span>Debug</span>
                                                    <span class="item-desc">Diagnose and fix software issues</span>
                                                </div>
                                                <svg class="item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                                            </div>
                                            <div class="dropdown-item" data-mode="Orchestrator">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/><line x1="12" y1="12" x2="19" y2="12"/></svg>
                                                <div>
                                                    <span>Orchestrator</span>
                                                    <span class="item-desc">Coordinate tasks across multiple modes</span>
                                                </div>
                                                <svg class="item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                                            </div>
                                            <div class="dropdown-item" data-mode="Review">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-2a4 4 0 0 1 4-4h14M7 21.9l-4-4 4-4"/><path d="M21 11.8v2a4 4 0 0 1-4 4H3"/></svg>
                                                <div>
                                                    <span>Review</span>
                                                    <span class="item-desc">Review code changes locally</span>
                                                </div>
                                                <svg class="item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                                            </div>
                                            <div class="dropdown-footer">Edit...</div>
                                        </div>
                                    </div>

                                    <div class="input-actions">
                                         <!-- Download (Context) Icon -->
                                        <div class="icon-btn" title="Add Context">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #888;">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                            </svg>
                                        </div>
                                        <!-- Attach Icon -->
                                        <div class="icon-btn" title="Attach Files">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #888;">
                                                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                            </svg>
                                        </div>
                                        <!-- Send Icon -->
                                        <div class="icon-btn" onclick="send()" style="color: var(--aion-primary)">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="status-bar">
                                <div class="model-info" id="model-trigger" style="position: relative;">
                                    <span id="active-model">MiniMax: MiniMax M2.1 (free)</span>
                                    <div class="dropdown" id="model-dropdown" style="left: 0; bottom: 100%;">
                                        <div class="dropdown-search"><input type="text" placeholder="Search..."></div>
                                        <div class="dropdown-section-title">Recommended Models</div>
                                        <div class="dropdown-item active" data-model="MiniMax: MiniMax M2.1 (free)">
                                            <span>MiniMax: MiniMax M2.1 (free)</span>
                                        </div>
                                        <div class="dropdown-item" data-model="Z.AI: GLM 4.7 (free)">
                                            <span>Z.AI: GLM 4.7 (free)</span>
                                        </div>
                                        <div class="dropdown-item" data-model="Anthropic: Claude 3.5 Sonnet">
                                            <span>Anthropic: Claude 3.5 Sonnet</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="status-actions">
                                    <div class="icon-btn" onclick="toggleSettings()">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                    </div>
                                    <div class="icon-btn">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    // Utility to detect Hebrew text for RTL support
                    function isHebrew(text) {
                        return /[\u0590-\u05FF]/.test(text || '');
                    }

                    const msg = document.getElementById('msg');

                    function send() {
                        const text = msg.value.trim();
                        if (text) {
                            document.getElementById('hero-view').style.display = 'none';
                            document.getElementById('new-task-container').style.display = 'block';
                            
                            const modeElement = document.getElementById('active-mode');
                            const mode = modeElement ? modeElement.textContent.trim() : 'Code';
                            
                            vscode.postMessage({ type: 'sendMessage', value: { text, mode } });
                            msg.value = '';
                            msg.style.height = 'auto';
                        }
                    }

                    function startNewTask() {
                        document.getElementById('messages-container').innerHTML = '';
                        document.getElementById('hero-view').style.display = 'flex';
                        document.getElementById('new-task-container').style.display = 'none';
                        vscode.postMessage({ type: 'resetTask' });
                    }

                    msg.addEventListener('input', function() {
                        this.style.height = 'auto';
                        this.style.height = (this.scrollHeight) + 'px';
                        
                        if (isHebrew(this.value)) {
                            this.dir = 'rtl';
                        } else {
                            this.dir = 'ltr';
                        }
                    });

                    function getRoleHeader(role, text) {
                        if (role === 'thought') return '🤔 Thinking';
                        if (text && text.includes('Plan Created')) return '📝 Plan Created';
                        if (text && text.includes('Task Completed')) return '✅ Task Completed';
                        if (role === 'tool') return '🔧 Tool Execution';
                        return role.charAt(0).toUpperCase() + role.slice(1);
                    }

                    window.addEventListener('message', event => {
                        try {
                            const data = event.data;
                            if (data.type === 'addMessage') {
                                const container = document.getElementById('messages-container');
                                const div = document.createElement('div');
                                div.className = 'task-card ' + data.role;
                                
                                if (isHebrew(data.text)) div.classList.add('rtl');
                                else div.classList.add('ltr');

                                let content = '<div class="card-header">' + getRoleHeader(data.role, data.text) + '</div>';
                                content += '<div class="task-text" style="-webkit-line-clamp: unset;">' + (data.text || '') + '</div>';
                                
                                if (data.toolCall) {
                                    content += '<div style="font-size: 10px; color: #888; border-top: 1px solid var(--aion-border); margin-top: 8px; padding-top: 4px;">Tool: ' + data.toolCall.name + '</div>';
                                }
                                
                                div.innerHTML = content;

                                if (data.requiresApproval) {
                                    const approvalDiv = document.createElement('div');
                                    approvalDiv.className = 'approval-container';
                                    
                                    const approveBtn = document.createElement('button');
                                    approveBtn.className = 'btn btn-approve';
                                    approveBtn.textContent = 'Approve';
                                    approveBtn.onclick = () => {
                                        vscode.postMessage({ type: 'respondToPermission', value: { granted: true } });
                                        approvalDiv.remove();
                                    };
                                    
                                    const rejectBtn = document.createElement('button');
                                    rejectBtn.className = 'btn btn-reject';
                                    rejectBtn.textContent = 'Reject';
                                    rejectBtn.onclick = () => {
                                        vscode.postMessage({ type: 'respondToPermission', value: { granted: false } });
                                        approvalDiv.remove();
                                    };
                                    
                                    approvalDiv.appendChild(approveBtn);
                                    approvalDiv.appendChild(rejectBtn);
                                    div.appendChild(approvalDiv);
                                }

                                container.appendChild(div);
                                const chatContent = document.getElementById('chat-content');
                                chatContent.scrollTop = chatContent.scrollHeight;
                            } else if (data.type === 'setThinking') {
                                const indicator = document.getElementById('thinking-indicator');
                                if (data.value) {
                                    indicator.classList.add('show');
                                    const chatContent = document.getElementById('chat-content');
                                    chatContent.appendChild(indicator);
                                    chatContent.scrollTop = chatContent.scrollHeight;
                                } else {
                                    indicator.classList.remove('show');
                                }
                            }
                        } catch (e) {
                            console.error('Webview Error:', e);
                        }
                    });

                    function toggleSettings() {
                        const el = document.getElementById('settings-view');
                        if(el) el.classList.toggle('show');
                    }

                    function saveSettings() {
                        const provider = document.getElementById('setting-provider').value;
                        const key = document.getElementById('setting-key').value;
                        const model = document.getElementById('setting-model').value;
                        const url = document.getElementById('setting-url').value;
                        vscode.postMessage({ type: 'saveSettings', value: { provider, key, model, url } });
                        toggleSettings();
                    }

                    msg.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    });

                    function setupDropdown(triggerId, dropdownId, activeLabelId, dataAttr) {
                        const trigger = document.getElementById(triggerId);
                        const dropdown = document.getElementById(dropdownId);
                        const activeLabel = document.getElementById(activeLabelId);
                        const searchInput = dropdown.querySelector('.dropdown-search input');

                        if(!trigger || !dropdown) return;

                        trigger.addEventListener('click', (e) => {
                            e.stopPropagation();
                            document.querySelectorAll('.dropdown').forEach(d => {
                                if (d !== dropdown) d.classList.remove('show');
                            });
                            dropdown.classList.toggle('show');
                            if (dropdown.classList.contains('show') && searchInput) {
                                searchInput.focus();
                                searchInput.value = '';
                                filterItems('');
                            }
                        });

                        function filterItems(query) {
                            const items = dropdown.querySelectorAll('.dropdown-item');
                            const q = query.toLowerCase();
                            items.forEach(item => {
                                const title = item.querySelector('span')?.textContent.toLowerCase() || "";
                                if (title.startsWith(q)) {
                                    item.style.display = 'flex';
                                } else {
                                    item.style.display = 'none';
                                }
                            });
                        }

                        if (searchInput) {
                            searchInput.addEventListener('input', (e) => {
                                filterItems(e.target.value);
                            });
                            searchInput.addEventListener('click', (e) => {
                                e.stopPropagation();
                            });
                        }

                        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
                            item.addEventListener('click', () => {
                                dropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                                item.classList.add('active');
                                const val = item.getAttribute(dataAttr);
                                if (activeLabel) {
                                    const span = activeLabel.parentElement.querySelector('span'); // Finds itself or sibling?
                                    // activeLabel is the span. parentElement is .pill.
                                    // .pill has ONE span (activeLabel).
                                    // Actually looking at HTML: <div class="pill"><svg>...</svg><span id="active-mode">Code</span></div>
                                    // So activeLabel IS the span.
                                    activeLabel.textContent = val;
                                }
                                dropdown.classList.remove('show');
                            });
                        });
                        
                        dropdown.addEventListener('click', (e) => {
                            e.stopPropagation();
                        });
                    }

                    setupDropdown('mode-trigger', 'mode-dropdown', 'active-mode', 'data-mode');
                    setupDropdown('model-trigger', 'model-dropdown', 'active-model', 'data-model');

                    window.addEventListener('click', () => {
                        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('show'));
                    });
                </script>
            </body>
            </html>`;
    }
}
