import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class FileFilter {
    private ignorePatterns: string[] = [];
    private includePatterns: string[] = [];
    private devAnalysisPatterns: string[] = [];
    private devCreatePatterns: string[] = [];
    private whitelistActive = false;
    private ignoreListActive = true;
    private loaded = false;

    async loadSettings() {
        if (this.loaded) return;

        const config = vscode.workspace.getConfiguration('md-translator');
        this.ignoreListActive = config.get<boolean>('ignoreListActive') ?? true;
        const ignoreFilesConfig = config.get<string[]>('ignoreFiles') || [];
        this.whitelistActive = config.get<boolean>('whitelistActive') ?? false;

        const includeFilesConfig = config.get<string[]>('includeFiles') || [];
        const analysisIncludeConfig = config.get<string[]>('devAnalysisIncludeFiles') || [];
        const createIncludeConfig = config.get<string[]>('devCreateIncludeFiles') || [];

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        this.ignorePatterns = this.loadPatterns(ignoreFilesConfig, workspaceRoot);
        this.includePatterns = this.loadPatterns(includeFilesConfig, workspaceRoot);
        this.devAnalysisPatterns = this.loadPatterns(analysisIncludeConfig, workspaceRoot);
        this.devCreatePatterns = this.loadPatterns(createIncludeConfig, workspaceRoot);

        this.loaded = true;
    }

    private loadPatterns(entries: string[], workspaceRoot: string): string[] {
        const result: string[] = [];
        for (const entry of entries) {
            if (entry.includes('*') || (entry.includes('/') && !entry.startsWith('.'))) {
                result.push(entry);
                continue;
            }
            const fullPath = path.join(workspaceRoot, entry);
            if (fs.existsSync(fullPath)) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const patterns = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
                    result.push(...patterns);
                } catch (e) { /* ignore */ }
            } else {
                result.push(entry);
            }
        }
        return result;
    }

    refresh() {
        this.loaded = false;
    }

    isAllowed(filePath: string, zone: 'translate' | 'analysis' | 'create' | 'upgrade' = 'translate'): { allowed: boolean, reason?: string } {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return { allowed: true };
        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        if (this.isIgnored(filePath, workspaceRoot)) {
            return { allowed: false, reason: 'File ignored by patterns' };
        }

        if (zone === 'translate' && this.whitelistActive && !this.isIncluded(filePath, workspaceRoot, this.includePatterns)) {
            return { allowed: false, reason: 'File not matched by whitelist patterns' };
        }

        if ((zone === 'analysis' || zone === 'upgrade') && !this.isIncluded(filePath, workspaceRoot, this.devAnalysisPatterns)) {
            return { allowed: false, reason: 'File not matched by analysis whitelist' };
        }

        if (zone === 'create' && !this.isIncluded(filePath, workspaceRoot, this.devCreatePatterns)) {
            return { allowed: false, reason: 'File not matched by creation whitelist' };
        }

        return { allowed: true };
    }

    private isIncluded(filePath: string, workspaceRoot: string, patterns: string[]): boolean {
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
        const fileName = path.basename(filePath);

        for (const pattern of patterns) {
            let cleanPattern = pattern.replace(/^\//, '').replace(/\/$/, '');
            if (relativePath === cleanPattern || fileName === cleanPattern) return true;
            if (relativePath.startsWith(cleanPattern + '/')) return true;
            if (cleanPattern.startsWith('**/')) {
                const subPattern = cleanPattern.slice(3);
                if (this.matchPattern(fileName, subPattern) || this.matchPattern(relativePath, subPattern)) return true;
            }
            if (cleanPattern.startsWith('*.')) {
                if (fileName.endsWith(cleanPattern.slice(1))) return true;
            }
            if (cleanPattern.endsWith('/**')) {
                const dirPattern = cleanPattern.slice(0, -3);
                if (relativePath === dirPattern || relativePath.startsWith(dirPattern + '/')) return true;
            }
        }
        return false;
    }

    private isIgnored(filePath: string, workspaceRoot: string): boolean {
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
        const fileName = path.basename(filePath);

        for (const pattern of this.ignorePatterns) {
            let cleanPattern = pattern.replace(/^\//, '').replace(/\/$/, '');
            if (relativePath === cleanPattern || fileName === cleanPattern) return true;
            if (relativePath === cleanPattern || relativePath.startsWith(cleanPattern + '/')) return true;
            if (cleanPattern.startsWith('**/')) {
                const subPattern = cleanPattern.slice(3);
                if (this.matchPattern(fileName, subPattern) || this.matchPattern(relativePath, subPattern)) return true;
                const pathParts = relativePath.split('/');
                for (const part of pathParts) {
                    if (this.matchPattern(part, subPattern)) return true;
                }
            }
            if (cleanPattern.startsWith('*.')) {
                const ext = cleanPattern.slice(1);
                if (fileName.endsWith(ext)) return true;
            }
            if (cleanPattern.endsWith('/**')) {
                const dirPattern = cleanPattern.slice(0, -3);
                if (relativePath === dirPattern || relativePath.startsWith(dirPattern + '/')) return true;
            }
            if (cleanPattern.includes('*')) {
                const regexPattern = cleanPattern
                    .replace(/\*\*/g, '{{DOUBLESTAR}}')
                    .replace(/\*/g, '[^/]*')
                    .replace(/{{DOUBLESTAR}}/g, '.*')
                    .replace(/\./g, '\\.')
                    .replace(/\?/g, '.');
                const regex = new RegExp('^' + regexPattern + '$');
                if (regex.test(relativePath) || regex.test(fileName)) return true;
            }
        }
        return false;
    }

    private matchPattern(str: string, pattern: string): boolean {
        if (pattern.includes('*')) {
            const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
            const regex = new RegExp('^' + regexPattern + '$');
            return regex.test(str);
        }
        return str === pattern;
    }
}
