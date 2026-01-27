import * as vscode from 'vscode';
import * as path from 'path';
import { AiService } from './AiService';
import { FileFilter } from './FileFilter';

let aiService: AiService;
let fileFilter: FileFilter;

export function activate(context: vscode.ExtensionContext) {
    console.log('MD Translator: Activating...');
    try {
        aiService = new AiService();
        fileFilter = new FileFilter();

        // Initial load of settings
        fileFilter.loadSettings().then(() => {
            console.log('MD Translator: Settings loaded.');
        }).catch(err => {
            console.error('MD Translator: Failed to load settings:', err);
        });

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('md-translator')) {
                fileFilter.refresh();
                fileFilter.loadSettings();
                console.log('MD Translator: Configuration refreshed.');
            }
        });
        console.log('MD Translator: Listeners established.');
    } catch (e) {
        console.error('MD Translator: Activation error:', e);
        vscode.window.showErrorMessage('MD Translator: Activation failed. See console for details.');
    }

    const disposableShowPreview = vscode.commands.registerCommand(
        'md-translator.showPreview',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('Open a file first.');
                return;
            }
            const doc = editor.document;
            const { allowed, reason } = fileFilter.isAllowed(doc.uri.fsPath, 'translate');
            if (!allowed) {
                vscode.window.showWarningMessage(`This file is blocked: ${reason}. Check settings.`);
                return;
            }
            await showTranslatedPreview(doc, context);
        }
    );

    const disposableDevAnalysis = vscode.commands.registerCommand(
        'md-translator.devAnalysis',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const doc = editor.document;
            const { allowed, reason } = fileFilter.isAllowed(doc.uri.fsPath, 'analysis');
            if (!allowed) {
                vscode.window.showWarningMessage(`Analysis blocked: ${reason}`);
                return;
            }
            await showDevelopmentRecommendations(doc, context);
        }
    );

    const disposableDevCreate = vscode.commands.registerCommand(
        'md-translator.devCreate',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const doc = editor.document;
            const { allowed, reason } = fileFilter.isAllowed(doc.uri.fsPath, 'create');
            if (!allowed) {
                vscode.window.showWarningMessage(`Creation blocked: ${reason}`);
                return;
            }
            await handleDevCreate(doc, context);
        }
    );

    context.subscriptions.push(disposableShowPreview, disposableDevAnalysis, disposableDevCreate);
}

async function showTranslatedPreview(
    doc: vscode.TextDocument,
    context: vscode.ExtensionContext
) {
    const config = vscode.workspace.getConfiguration('md-translator');
    const targetLang = config.get<string>('language') || 'en';
    const originalText = doc.getText();

    // Show progress notification
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Translating and summarizing...",
        cancellable: false
    }, async () => {
        try {
            const { translatedText, summary } = await aiService.translateAndSummarize(originalText);

            const panel = vscode.window.createWebviewPanel(
                'mdTranslatorPreview',
                `Translated: ${vscode.workspace.asRelativePath(doc.uri)} → ${targetLang}`,
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );

            const isRTL = ['he', 'ar', 'fa', 'ur'].includes(targetLang.toLowerCase());
            panel.webview.html = getWebviewContent(translatedText, summary, isRTL, targetLang);
        } catch (error) {
            vscode.window.showErrorMessage(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}

async function showDevelopmentRecommendations(
    doc: vscode.TextDocument,
    context: vscode.ExtensionContext
) {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Analyzing code for improvements...",
        cancellable: false
    }, async () => {
        try {
            const recommendations = await aiService.getRecommendations(doc.getText());
            const panel = vscode.window.createWebviewPanel(
                'mdDevAnalysis',
                `AI Recommendations: ${path.basename(doc.uri.fsPath)}`,
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );

            panel.webview.html = getRecommendationsWebviewContent(recommendations);

            panel.webview.onDidReceiveMessage(async message => {
                if (message.command === 'applyCode') {
                    const { before, after } = message.data;
                    const text = doc.getText();
                    if (text.includes(before)) {
                        const edit = new vscode.WorkspaceEdit();
                        const startPos = doc.positionAt(text.indexOf(before));
                        const endPos = doc.positionAt(text.indexOf(before) + before.length);
                        edit.replace(doc.uri, new vscode.Range(startPos, endPos), after);
                        await vscode.workspace.applyEdit(edit);
                        vscode.window.showInformationMessage('Improvement applied!');
                    } else {
                        vscode.window.showWarningMessage('Could not find the original code block to replace.');
                    }
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}

async function handleDevCreate(
    doc: vscode.TextDocument,
    context: vscode.ExtensionContext
) {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating code...",
        cancellable: false
    }, async () => {
        try {
            const description = doc.getText();
            const code = await aiService.generateCode(description);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(doc.uri, new vscode.Range(0, 0, doc.lineCount, 0), code);
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage('Code generation complete!');
        } catch (error) {
            vscode.window.showErrorMessage(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}

function getWebviewContent(
    translated: string,
    summary: string,
    isRTL: boolean,
    targetLang: string
): string {
    const dir = isRTL ? 'rtl' : 'ltr';
    const textAlign = isRTL ? 'right' : 'left';

    // Simple markdown-like rendering for summary and translation
    const formatText = (text: string) => {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
    };

    return `<!DOCTYPE html>
<html lang="${targetLang}" dir="${dir}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family, system-ui, sans-serif);
            padding: 20px;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            direction: ${dir};
            text-align: ${textAlign};
        }
        h2 {
            color: var(--vscode-textLink-foreground);
            margin-top: 1.5em;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 0.3em;
        }
        .summary-box {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            border-radius: 4px;
            margin-bottom: 20px;
        }
        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
        }
        li { margin-bottom: 0.5em; }
    </style>
</head>
<body>
    <h2>${isRTL ? 'תקציר' : 'Summary'}</h2>
    <div class="summary-box">
        <p>${formatText(summary)}</p>
    </div>

    <h2>${isRTL ? 'תרגום' : 'Translation'}</h2>
    <div class="content">
        <p>${formatText(translated)}</p>
    </div>
</body>
</html>`;
}

function getRecommendationsWebviewContent(recommendations: any[]): string {
    const items = recommendations.map((rec, i) => `
        <div class="card">
            <h3>${rec.title}</h3>
            <p>${rec.reason}</p>
            <div class="code-container">
                <div class="code-header">Before</div>
                <pre><code>${escapeHtml(rec.before)}</code></pre>
            </div>
            <div class="code-container">
                <div class="code-header">After</div>
                <pre><code>${escapeHtml(rec.after)}</code></pre>
            </div>
            <button onclick="applyCode(${i})">Apply This Improvement</button>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; padding: 20px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
        .card { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 15px; margin-bottom: 20px; background: var(--vscode-sideBar-background); }
        h3 { color: var(--vscode-textLink-foreground); margin-top: 0; }
        .code-container { margin-top: 10px; background: var(--vscode-editor-background); border-radius: 4px; overflow: hidden; }
        .code-header { background: var(--vscode-titleBar-activeBackground); color: var(--vscode-titleBar-activeForeground); padding: 4px 8px; font-size: 0.8em; }
        pre { margin: 0; padding: 10px; overflow-x: auto; font-size: 0.9em; }
        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 15px; width: 100%; font-weight: bold; }
        button:hover { background: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <h1>AI Recommendations</h1>
    ${items.length ? items : '<p>No recommendations found for this file.</p>'}
    <script>
        const vscode = acquireVsCodeApi();
        const recs = ${JSON.stringify(recommendations)};
        function applyCode(index) {
            vscode.postMessage({
                command: 'applyCode',
                data: recs[index]
            });
        }
    </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function deactivate() { }
