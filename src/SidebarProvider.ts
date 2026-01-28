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
        this._agent = new Agent(this._aiService, (msg) => this._postAgentMessage(msg));
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
                    await this._agent.handleUserMessage(text, mode);
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
            toolResult: message.toolResult
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
                    }
                    
                    /* Content */
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
                    
                    .hero {
                        text-align: center;
                        margin-top: 22px;
                        color: #fff;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 20px;
                        padding: 0 20px;
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

                    /* Input Area */
                    .footer {
                        padding: 8px 12px 0 12px;
                        border-top: none;
                    }
                    .input-container {
                        background: var(--aion-input-bg);
                        border: 1px solid var(--vscode-focusBorder);
                        border-radius: 8px;
                        padding: 8px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    .input-row {
                        display: flex;
                        gap: 8px;
                        align-items: flex-start;
                    }
                    textarea {
                        flex: 1;
                        background: transparent;
                        border: none;
                        color: var(--vscode-input-foreground);
                        resize: none;
                        outline: none;
                        font-family: inherit;
                        font-size: 13px;
                        min-height: 60px;
                        padding: 4px;
                    }
                    .toolbar {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .toolbar-left, .toolbar-right {
                        display: flex;
                        gap: 10px;
                        align-items: center;
                        position: relative;
                    }
                    .pill {
                        background: rgba(255,255,255,0.05);
                        border: 1px solid var(--aion-border);
                        border-radius: 4px;
                        padding: 4px 8px;
                        font-size: 11px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        cursor: pointer;
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
                <div class="content">
                    <div class="hero">
                        <img src="${logoUri}" class="hero-logo" alt="Aion Logo">
                        <h2 class="hero-title">What can I do for you?</h2>
                        <div class="hero-subtitle">
                            Ready to ship? The code won't write itself—not without me, anyway.
                        </div>
                    </div>

                    <div class="recent-tasks-area">
                        <div class="section-header">
                            <span>Recent Tasks</span>
                            <span class="view-all">View all</span>
                        </div>
                        ${recentTasks.map(task => `
                            <div class="task-card">
                                <div class="task-text">${task.text}</div>
                                <div class="task-footer">
                                    <span>${task.date} ·</span>
                                    <div class="task-actions">
                                        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3z"/></svg>
                                        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/></svg>
                                        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.242 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/><path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.586-.586a1.001 1.001 0 0 0 .154-.199 2 2 0 0 1-.861-3.337L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792a4.018 4.018 0 0 1 .128 1.287l1.372-1.372a3 3 0 1 0-4.242-4.243L6.586 4.672z"/></svg>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="footer">
                    <div class="input-container">
                        <div class="input-row">
                            <textarea id="msg" dir="auto" placeholder="Type your task here...
(@ to add context, / for commands, hold shift to drag in files)"></textarea>
                            <div class="icon-btn" style="margin-top: 5px;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="m3.34 19 1.4-1.4"/><path d="M5.07 15.15 15.15 5.07a2.12 2.12 0 1 1 3 3L8.04 18.15a1 1 0 0 1-.7.29H5.07a1 1 0 0 1-1-1v-2.18a1 1 0 0 1 .29-.7z"/><path d="m14.5 12.5 1-1"/><path d="m3 21 1.4-1.4"/><path d="m18.5 7.5 1-1"/><path d="m10.5 16.5 1-1"/><path d="m5 19 1.4-1.4"/></svg>
                            </div>
                        </div>
                        <div class="toolbar">
                            <div class="toolbar-left">
                                <div class="pill" id="mode-trigger">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><polyline points="18 15 12 9 6 15"/></svg>
                                    <svg viewBox="0 0 16 16" fill="currentColor"><path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z"/></svg>
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
                             <div class="toolbar-right">
                                <div class="icon-btn">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </div>
                                <div class="icon-btn">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                </div>
                                <div class="icon-btn" onclick="send()" style="color: var(--aion-primary)">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="status-bar">
                    <div style="display: flex; align-items: center; gap: 4px; cursor: pointer;" id="model-trigger">
                        <span id="active-model">MiniMax: MiniMax M2.1 (free)</span>
                        <div class="dropdown" id="model-dropdown" style="left: 12px; bottom: 30px;">
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
                    <div style="display: flex; gap: 12px; font-size: 14px;">
                        <span class="icon-btn">⚖️</span>
                        <span class="icon-btn">👤</span>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const msg = document.getElementById('msg');

                    function send() {
                        const text = msg.value.trim();
                        if (text) {
                            const mode = document.getElementById('active-mode').textContent;
                            vscode.postMessage({ type: 'sendMessage', value: { text, mode } });
                            msg.value = '';
                        }
                    }

                    function isHebrew(text) {
                        const hebrewPattern = /[\u0590-\u05FF]/;
                        return hebrewPattern.test(text);
                    }

                    window.addEventListener('message', event => {
                        const data = event.data;
                        if (data.type === 'addMessage') {
                            const chatContent = document.querySelector('.content');
                            const div = document.createElement('div');
                            div.className = 'task-card ' + data.role;
                            
                            // Special styling for thoughts and tools
                            if (data.role === 'thought') {
                                div.style.opacity = '0.6';
                                div.style.fontSize = '12px';
                                div.style.fontStyle = 'italic';
                                div.style.borderLeft = '2px solid var(--aion-primary)';
                            } else if (data.role === 'tool') {
                                div.style.background = 'rgba(0, 122, 204, 0.1)';
                                div.style.borderColor = '#007acc';
                            }

                            // Detect Hebrew and apply RTL
                            if (isHebrew(data.text)) {
                                div.classList.add('rtl');
                            } else {
                                div.classList.add('ltr');
                            }

                            let content = '<div class="task-text">' + data.text + '</div>';
                            if (data.toolCall) {
                                content += '<div style="font-size: 10px; color: #888;">Tool: ' + data.toolCall.name + '</div>';
                            }
                            
                            div.innerHTML = content;
                            chatContent.appendChild(div);
                            chatContent.scrollTop = chatContent.scrollHeight;
                        }
                    });

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
                                    const span = activeLabel.parentElement.querySelector('span');
                                    if (span) span.textContent = val;
                                    else activeLabel.textContent = val;
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
