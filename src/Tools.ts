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
    }
];
