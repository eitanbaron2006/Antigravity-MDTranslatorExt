import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Tool {
    name: string;
    description: string;
    parameters: any;
    execute: (args: any) => Promise<string>;
}

export const TOOLS: Tool[] = [
    {
        name: 'read_file',
        description: 'Read the contents of a file in the workspace.',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Relative path to the file.' }
            },
            required: ['filePath']
        },
        execute: async (args: { filePath: string }) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return 'Error: No workspace open.';
            const fullPath = path.join(workspaceFolders[0].uri.fsPath, args.filePath);
            try {
                const content = await vscode.workspace.fs.readFile(vscode.Uri.file(fullPath));
                return Buffer.from(content).toString('utf8');
            } catch (err: any) {
                return `Error reading file ${args.filePath}: ${err.message}`;
            }
        }
    },
    {
        name: 'write_to_file',
        description: 'Write or overwrite a file in the workspace.',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Relative path to the file.' },
                content: { type: 'string', description: 'Content to write.' }
            },
            required: ['filePath', 'content']
        },
        execute: async (args: { filePath: string, content: string }) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return 'Error: No workspace open.';
            const fullPath = path.join(workspaceFolders[0].uri.fsPath, args.filePath);
            try {
                await vscode.workspace.fs.writeFile(vscode.Uri.file(fullPath), Buffer.from(args.content, 'utf8'));
                return `Successfully wrote to ${args.filePath}`;
            } catch (err: any) {
                return `Error writing to file ${args.filePath}: ${err.message}`;
            }
        }
    },
    {
        name: 'list_dir',
        description: 'List files and directories in a given path.',
        parameters: {
            type: 'object',
            properties: {
                dirPath: { type: 'string', description: 'Relative path to the directory (empty for root).' }
            }
        },
        execute: async (args: { dirPath?: string }) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return 'Error: No workspace open.';
            const relativePath = args.dirPath || '';
            const fullPath = path.join(workspaceFolders[0].uri.fsPath, relativePath);
            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(fullPath));
                return entries.map(([name, type]) => `${name} (${type === vscode.FileType.Directory ? 'dir' : 'file'})`).join('\n');
            } catch (err: any) {
                return `Error listing directory ${relativePath}: ${err.message}`;
            }
        }
    },
    {
        name: 'run_command',
        description: 'Run a shell command in the workspace root.',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'The command to run.' }
            },
            required: ['command']
        },
        execute: async (args: { command: string }) => {
            // Implementation of run_command requires careful handling of output and potential interactive prompts.
            // For now, we integrate with terminal or exec.
            return new Promise((resolve) => {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                const cwd = workspaceFolders ? workspaceFolders[0].uri.fsPath : undefined;

                require('child_process').exec(args.command, { cwd }, (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        resolve(`Error: ${error.message}\nStderr: ${stderr}`);
                    } else {
                        resolve(stdout || stderr || 'Command executed successfully (no output).');
                    }
                });
            });
        }
    },
    {
        name: 'list_files_recursive',
        description: 'Recursively list all files in the workspace with optional filtering.',
        parameters: {
            type: 'object',
            properties: {
                include: { type: 'string', description: 'Glob pattern for files to include (e.g., "**/*.ts").' },
                exclude: { type: 'string', description: 'Glob pattern for files to exclude.' }
            }
        },
        execute: async (args: { include?: string, exclude?: string }) => {
            try {
                const files = await vscode.workspace.findFiles(args.include || '**/*', args.exclude || '**/node_modules/**');
                return files.map(f => vscode.workspace.asRelativePath(f)).join('\n');
            } catch (err: any) {
                return `Error listing files: ${err.message}`;
            }
        }
    },
    {
        name: 'search_files',
        description: 'Search for text patterns across the entire workspace.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The text pattern to search for.' },
                include: { type: 'string', description: 'Glob pattern to limit search (e.g., "**/*.ts").' }
            },
            required: ['query']
        },
        execute: async (args: { query: string, include?: string }) => {
            try {
                const files = await vscode.workspace.findFiles(args.include || '**/*', '**/node_modules/**');
                const results: string[] = [];
                const searchRegex = new RegExp(args.query, 'i');

                for (const file of files.slice(0, 50)) { // Limit to 50 files for performance
                    const content = await vscode.workspace.fs.readFile(file);
                    const text = Buffer.from(content).toString('utf8');
                    const lines = text.split('\n');
                    lines.forEach((line, i) => {
                        if (searchRegex.test(line)) {
                            results.push(`${vscode.workspace.asRelativePath(file)}:${i + 1}: ${line.trim()}`);
                        }
                    });
                    if (results.length > 100) break;
                }

                return results.length > 0 ? results.join('\n') : 'No results found.';
            } catch (err: any) {
                return `Error searching files: ${err.message}`;
            }
        }
    },
    {
        name: 'apply_diff',
        description: 'Apply a search-and-replace edit to a file.',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Relative path to the file.' },
                search: { type: 'string', description: 'The exact string to search for.' },
                replace: { type: 'string', description: 'The string to replace it with.' }
            },
            required: ['filePath', 'search', 'replace']
        },
        execute: async (args: { filePath: string, search: string, replace: string }) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return 'Error: No workspace open.';
            const fullPath = path.join(workspaceFolders[0].uri.fsPath, args.filePath);
            try {
                const uri = vscode.Uri.file(fullPath);
                const content = await vscode.workspace.fs.readFile(uri);
                const text = Buffer.from(content).toString('utf8');

                if (!text.includes(args.search)) {
                    return `Error: Could not find exact match for the search string in ${args.filePath}`;
                }

                const newText = text.replace(args.search, args.replace);
                await vscode.workspace.fs.writeFile(uri, Buffer.from(newText, 'utf8'));
                return `Successfully updated ${args.filePath}`;
            } catch (err: any) {
                return `Error applying diff to ${args.filePath}: ${err.message}`;
            }
        }
    },
    {
        name: 'get_workspace_context',
        description: 'Gather information about the current workspace state (active editor, diagnostics).',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
            const activeEditor = vscode.window.activeTextEditor;
            let context = '';
            if (activeEditor) {
                context += `Active Editor: ${vscode.workspace.asRelativePath(activeEditor.document.uri)}\n`;
                context += `Language: ${activeEditor.document.languageId}\n`;
            } else {
                context += 'No active editor.\n';
            }

            const diagnostics = vscode.languages.getDiagnostics();
            const errors = diagnostics.flatMap(([uri, diags]) =>
                diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error)
                    .map(d => `${vscode.workspace.asRelativePath(uri)}: ${d.message}`)
            ).slice(0, 10);

            if (errors.length > 0) {
                context += `Recent Errors:\n${errors.join('\n')}`;
            }

            return context || 'Workspace is clean.';
        }
    }
];
