import * as vscode from 'vscode';
import * as path from 'path';
import { AiService } from './AiService';
import { FileFilter } from './FileFilter';
import { SidebarProvider } from './SidebarProvider';

let aiService: AiService;
let fileFilter: FileFilter;

export function activate(context: vscode.ExtensionContext) {
    console.log('Aion: Activating...');
    try {
        aiService = new AiService();
        fileFilter = new FileFilter();

        const sidebarProvider = new SidebarProvider(context.extensionUri, aiService);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                SidebarProvider.viewType,
                sidebarProvider
            )
        );

        // Initial load of settings
        fileFilter.loadSettings().then(() => {
            console.log('MD Translator: Settings loaded.');
        }).catch(err => {
            console.error('MD Translator: Failed to load settings:', err);
        });

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('aion')) {
                fileFilter.refresh();
                fileFilter.loadSettings().then(() => {
                    updateContextKeys();
                });
                console.log('MD Translator: Configuration refreshed.');
            }
        });

        // Listen for editor changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            updateContextKeys();
        });

        vscode.workspace.onDidOpenTextDocument(() => {
            updateContextKeys();
        });

        updateContextKeys();
        console.log('Aion: Listeners established.');
    } catch (e) {
        console.error('Aion: Activation error:', e);
        vscode.window.showErrorMessage('Aion: Activation failed. See console for details.');
    }

    const disposableShowPreview = vscode.commands.registerCommand(
        'aion.showPreview',
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
        'aion.devAnalysis',
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
        'aion.devCreate',
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

    const disposableDevUpgrade = vscode.commands.registerCommand(
        'aion.devUpgrade',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const doc = editor.document;
            const { allowed, reason } = fileFilter.isAllowed(doc.uri.fsPath, 'upgrade');
            if (!allowed) {
                vscode.window.showWarningMessage(`Upgrade blocked: ${reason}`);
                return;
            }
            await handleDevUpgrade(doc, context);
        }
    );

    const disposableNewChat = vscode.commands.registerCommand('aion.newChat', () => {
        vscode.window.showInformationMessage('New Chat started.');
    });

    const disposableOpenLibrary = vscode.commands.registerCommand('aion.openLibrary', () => {
        vscode.window.showInformationMessage('Library coming soon.');
    });

    const disposableShowHistory = vscode.commands.registerCommand('aion.showHistory', () => {
        vscode.window.showInformationMessage('History coming soon.');
    });

    const disposableShowSettings = vscode.commands.registerCommand('aion.showSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'aion');
    });

    context.subscriptions.push(
        disposableShowPreview,
        disposableDevAnalysis,
        disposableDevCreate,
        disposableDevUpgrade,
        disposableNewChat,
        disposableOpenLibrary,
        disposableShowHistory,
        disposableShowSettings
    );
}

async function showTranslatedPreview(
    doc: vscode.TextDocument,
    context: vscode.ExtensionContext
) {
    const config = vscode.workspace.getConfiguration('aion');
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
            const config = vscode.workspace.getConfiguration('aion');
            const targetLang = config.get<string>('language') || 'en';
            const isRTL = ['he', 'ar', 'fa', 'ur'].includes(targetLang.toLowerCase());

            const labels = isRTL ? {
                title: "המלצות AI",
                before: "לפני",
                after: "אחרי",
                apply: "החל שיפור זה",
                applyAll: "בצע את כל השיפורים",
                noRecs: "לא נמצאו המלצות לקובץ זה.",
                applied: "השיפור הוחל!",
                allApplied: "כל השיפורים הוחלו!",
                notFound: "לא ניתן היה למצוא את בלוק הקוד המקורי להחלפה."
            } : {
                title: "AI Recommendations",
                before: "Before",
                after: "After",
                apply: "Apply This Improvement",
                applyAll: "Apply All Improvements",
                noRecs: "No recommendations found for this file.",
                applied: "Improvement applied!",
                allApplied: "All improvements applied!",
                notFound: "Could not find the original code block to replace."
            };

            const panel = vscode.window.createWebviewPanel(
                'mdDevAnalysis',
                `AI Recommendations: ${path.basename(doc.uri.fsPath)}`,
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );

            panel.webview.html = getRecommendationsWebviewContent(recommendations, isRTL, labels, doc.languageId);

            panel.webview.onDidReceiveMessage(async (message: any) => {
                if (message.command === 'applyCode') {
                    const { before, after } = message.data;
                    const applied = await applySingleRecommendation(doc, before, after);
                    if (applied) {
                        vscode.window.showInformationMessage(labels.applied);
                    } else {
                        vscode.window.showWarningMessage(labels.notFound);
                    }
                } else if (message.command === 'applyAllCodes') {
                    let count = 0;
                    for (const rec of recommendations) {
                        const applied = await applySingleRecommendation(doc, rec.before, rec.after);
                        if (applied) count++;
                    }
                    if (count > 0) {
                        vscode.window.showInformationMessage(`${labels.allApplied} (${count})`);
                    } else {
                        vscode.window.showWarningMessage(labels.notFound);
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
            const { code, suggestedFilename } = await aiService.generateCode(description);

            const config = vscode.workspace.getConfiguration('aion');
            const customPath = config.get<string>('devCreatePath') || '';
            const workspaceFolders = vscode.workspace.workspaceFolders;

            let targetUri: vscode.Uri;

            if (path.isAbsolute(customPath)) {
                targetUri = vscode.Uri.file(path.join(customPath, suggestedFilename));
            } else if (workspaceFolders) {
                targetUri = vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, customPath, suggestedFilename));
            } else {
                throw new Error("No workspace or absolute path defined.");
            }

            // Create directories if they don't exist
            const targetDir = path.dirname(targetUri.fsPath);
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));

            let counter = 1;
            const originalUri = targetUri;

            // Check if file exists and increment numbering if needed
            while (true) {
                try {
                    await vscode.workspace.fs.stat(targetUri);
                    // File exists, generate new name
                    const ext = path.extname(suggestedFilename);
                    const baseName = path.basename(suggestedFilename, ext);
                    const newName = `${baseName}-${counter}${ext}`;
                    targetUri = vscode.Uri.file(path.join(targetDir, newName));
                    counter++;
                } catch (e) {
                    // File does not exist, we found our target
                    break;
                }
            }

            await vscode.workspace.fs.writeFile(targetUri, Buffer.from(code, 'utf8'));

            const newDoc = await vscode.workspace.openTextDocument(targetUri);
            await vscode.window.showTextDocument(newDoc, vscode.ViewColumn.Beside);

            vscode.window.showInformationMessage(`Created: ${path.basename(targetUri.fsPath)}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}

async function handleDevUpgrade(
    doc: vscode.TextDocument,
    context: vscode.ExtensionContext
) {
    const config = vscode.workspace.getConfiguration('aion');
    const targetLang = config.get<string>('language') || 'en';
    const isRTL = ['he', 'ar', 'fa', 'ur'].includes(targetLang.toLowerCase());

    const labels = isRTL ? {
        title: "שדרוג קוד עם AI",
        placeholder: "תאר את השינויים שברצונך לבצע... (לדוגמה: הוסף טיפול בשגיאות)",
        upgrade: "שדרג קוד",
        cancel: "ביטול"
    } : {
        title: "AI Code Upgrade",
        placeholder: "Describe the changes you want to make... (e.g., Add error handling)",
        upgrade: "Upgrade Code",
        cancel: "Cancel"
    };

    const panel = vscode.window.createWebviewPanel(
        'mdDevUpgrade',
        labels.title,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = getUpgradePromptWebviewContent(isRTL, labels);

    panel.webview.onDidReceiveMessage(async (message: any) => {
        if (message.command === 'submitPrompt') {
            const userPrompt = message.text;
            panel.dispose();

            if (!userPrompt) return;

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: isRTL ? "משדרג קוד..." : "Upgrading code...",
                cancellable: false
            }, async () => {
                try {
                    // We don't need to check for activeTextEditor here because we have 'doc' from the closure.
                    // Checking activeTextEditor after panel.dispose() can fail if focus is in transition.

                    const text = doc.getText();
                    const upgradeResult = await aiService.upgradeCode(text, userPrompt);

                    const edit = new vscode.WorkspaceEdit();
                    const fullRange = new vscode.Range(
                        doc.positionAt(0),
                        doc.positionAt(text.length)
                    );

                    edit.replace(doc.uri, fullRange, upgradeResult);
                    const applied = await vscode.workspace.applyEdit(edit);

                    if (applied) {
                        vscode.window.showInformationMessage(isRTL ? "הקוד שודרג בהצלחה!" : "Code upgraded successfully!");
                    }
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            });
        } else if (message.command === 'cancel') {
            panel.dispose();
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

function getRecommendationsWebviewContent(
    recommendations: any[],
    isRTL: boolean,
    labels: any,
    languageId: string
): string {
    const dir = isRTL ? 'rtl' : 'ltr';
    const textAlign = isRTL ? 'right' : 'left';

    const items = recommendations.map((rec, i) => `
        <div class="card">
            <h3>${rec.title}</h3>
            <p>${rec.reason}</p>
            <div class="code-wrapper">
                <div class="code-header" style="text-align: ${isRTL ? 'right' : 'left'}; direction: ${isRTL ? 'rtl' : 'ltr'}">${labels.before}</div>
                <div class="code-container" dir="ltr">
                    <pre><code class="language-${languageId}">${escapeHtml(rec.before)}</code></pre>
                </div>
            </div>
            <div class="code-wrapper">
                <div class="code-header" style="text-align: ${isRTL ? 'right' : 'left'}; direction: ${isRTL ? 'rtl' : 'ltr'}">${labels.after}</div>
                <div class="code-container" dir="ltr">
                    <pre><code class="language-${languageId}">${escapeHtml(rec.after)}</code></pre>
                </div>
            </div>
            <button onclick="applyCode(${i})">${labels.apply}</button>
        </div>
    `).join('');

    const applyAllButton = recommendations.length > 1 ? `
        <button class="apply-all-btn" onclick="applyAll()">✨ ${labels.applyAll}</button>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://cdnjs.cloudflare.com; script-src 'unsafe-inline' https://cdnjs.cloudflare.com;">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
        body { 
            font-family: var(--vscode-font-family, sans-serif); 
            padding: 20px; 
            color: var(--vscode-foreground); 
            background: var(--vscode-editor-background); 
            direction: ${dir};
            text-align: ${textAlign};
        }
        .card { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 15px; margin-bottom: 20px; background: var(--vscode-sideBar-background); text-align: ${textAlign}; }
        h3 { color: var(--vscode-textLink-foreground); margin-top: 0; font-size: 1.1em; }
        .code-wrapper { margin-top: 10px; border: 1px solid var(--vscode-widget-border); border-radius: 4px; overflow: hidden; }
        .code-header { background: var(--vscode-editor-lineHighlightBackground); color: var(--vscode-descriptionForeground); padding: 5px 10px; font-size: 0.85em; border-bottom: 1px solid var(--vscode-widget-border); font-family: var(--vscode-font-family, sans-serif); }
        .code-container { background: #1e1e1e; text-align: left; }
        pre { margin: 0; padding: 0; }
        code { display: block; padding: 12px; overflow-x: auto; font-size: var(--vscode-editor-font-size, 14px); font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace); }
        
        button { 
            background: var(--vscode-button-secondaryBackground); 
            color: var(--vscode-button-secondaryForeground); 
            border: none; 
            padding: 6px 14px; 
            border-radius: 2px; 
            cursor: pointer; 
            margin-top: 10px; 
            width: auto; 
            font-size: 0.9em; 
            display: inline-block;
        }
        button:hover { background: var(--vscode-button-secondaryHoverBackground); }
        
        .apply-all-container {
            margin-top: 30px;
            margin-bottom: 50px;
            text-align: ${isRTL ? 'left' : 'right'};
            border-top: 1px solid var(--vscode-panel-border);
            padding-top: 20px;
        }
        .apply-all-btn { 
            background: var(--vscode-button-background); 
            color: var(--vscode-button-foreground);
            font-size: 1em; 
            padding: 8px 20px; 
        }
        .apply-all-btn:hover { background: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <h1>${labels.title}</h1>
    ${items.length ? items : `<p>${labels.noRecs}</p>`}
    
    ${recommendations.length > 1 ? `
    <div class="apply-all-container">
        <button class="apply-all-btn" onclick="applyAll()">✨ ${labels.applyAll}</button>
    </div>
    ` : ''}
    <script>
        hljs.highlightAll();
        const vscode = acquireVsCodeApi();
        const recs = ${JSON.stringify(recommendations).replace(/<\/script>/g, '<\\/script>')};
        function applyCode(index) {
            vscode.postMessage({
                command: 'applyCode',
                data: recs[index]
            });
        }
        function applyAll() {
            vscode.postMessage({
                command: 'applyAllCodes'
            });
        }
    </script>
</body>
</html>`;
}

async function applySingleRecommendation(doc: vscode.TextDocument, before: string, after: string): Promise<boolean> {
    const text = doc.getText();
    const index = text.indexOf(before);
    if (index !== -1) {
        const edit = new vscode.WorkspaceEdit();
        const startPos = doc.positionAt(index);
        const endPos = doc.positionAt(index + before.length);
        edit.replace(doc.uri, new vscode.Range(startPos, endPos), after);
        return await vscode.workspace.applyEdit(edit);
    }
    return false;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function updateContextKeys() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.commands.executeCommand('setContext', 'aion.isTranslateFile', false);
        vscode.commands.executeCommand('setContext', 'aion.isDevFile', false);
        vscode.commands.executeCommand('setContext', 'aion.isCreateFile', false);
        return;
    }

    const filePath = editor.document.uri.fsPath;

    const isTranslate = fileFilter.isAllowed(filePath, 'translate').allowed;
    const isDev = fileFilter.isAllowed(filePath, 'analysis').allowed;
    const isCreate = fileFilter.isAllowed(filePath, 'create').allowed;

    vscode.commands.executeCommand('setContext', 'aion.isTranslateFile', isTranslate);
    vscode.commands.executeCommand('setContext', 'aion.isDevFile', isDev);
    vscode.commands.executeCommand('setContext', 'aion.isCreateFile', isCreate);
}

function getUpgradePromptWebviewContent(isRTL: boolean, labels: any): string {
    const dir = isRTL ? 'rtl' : 'ltr';
    const textAlign = isRTL ? 'right' : 'left';

    return `<!DOCTYPE html>
<html lang="en" dir="${dir}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family, sans-serif);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            text-align: ${textAlign};
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
        }
        h2 { 
            color: var(--vscode-textLink-foreground); 
            margin-top: 0; 
            font-weight: normal;
        }
        textarea {
            width: 100%;
            flex-grow: 1;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 10px;
            font-family: var(--vscode-editor-font-family, monospace);
            resize: none;
            outline: none;
            margin-bottom: 15px;
            border-radius: 2px;
        }
        textarea:focus {
            border-color: var(--vscode-focusBorder);
        }
        .actions {
            display: flex;
            justify-content: ${isRTL ? 'flex-start' : 'flex-end'};
            gap: 10px;
            margin-bottom: 40px; /* Space from bottom */
        }
        button {
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 13px;
        }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <h2>${labels.title}</h2>
    <textarea id="prompt" placeholder="${labels.placeholder}"></textarea>
    <div class="actions">
        <button class="btn-secondary" onclick="cancel()">${labels.cancel}</button>
        <button class="btn-primary" onclick="submit()">🚀 ${labels.upgrade}</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const textarea = document.getElementById('prompt');
        
        // Focus immediately
        textarea.focus();

        function submit() {
            vscode.postMessage({
                command: 'submitPrompt',
                text: textarea.value
            });
        }

        function cancel() {
            vscode.postMessage({ command: 'cancel' });
        }

        // Handle Ctrl+Enter to submit
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                submit();
            }
        });
    </script>
</body>
</html>`;
}

export function deactivate() { }
