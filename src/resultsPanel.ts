import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { KnipResult } from './knipAnalyzer';

export class ResultsPanel {
    private panel?: vscode.WebviewPanel;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async show(result: KnipResult, projectPath: string): Promise<void> {
        if (this.panel) {
            this.panel.dispose();
        }

        this.panel = vscode.window.createWebviewPanel(
            'knipResults',
            'Knip 分析结果',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.generateHTML(result);

        // 处理来自 webview 的消息
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'deleteFile':
                        await this.deleteFile(message.filePath, projectPath);
                        break;
                    case 'openFile':
                        await this.openFile(message.filePath, projectPath);
                        break;
                    case 'removeDependency':
                        await this.removeDependency(message.dependency, projectPath, false);
                        break;
                    case 'removeDevDependency':
                        await this.removeDependency(message.dependency, projectPath, true);
                        break;
                    case 'refresh':
                        // 重新扫描
                        vscode.commands.executeCommand('knip-cleaner.scan');
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private generateHTML(result: KnipResult): string {
        const unusedFiles = result.files || [];
        const unusedDeps = result.dependencies || [];
        const unusedDevDeps = result.devDependencies || [];
        const unusedExports = result.exports || {};

        const totalIssues = unusedFiles.length + unusedDeps.length + unusedDevDeps.length + Object.keys(unusedExports).length;

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Knip 分析结果</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .summary {
            background: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }
        
        .section {
            margin: 30px 0;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            overflow: hidden;
        }
        
        .section-header {
            background: var(--vscode-panel-background);
            padding: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .section-content {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            transition: background-color 0.2s;
        }
        
        .item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .item:last-child {
            border-bottom: none;
        }
        
        .item-info {
            flex: 1;
            min-width: 0;
        }
        
        .item-path {
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
            word-break: break-all;
        }
        
        .item-exports {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        .actions {
            display: flex;
            gap: 8px;
            flex-shrink: 0;
        }
        
        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 0.85em;
            transition: all 0.2s;
        }
        
        .btn:hover {
            transform: translateY(-1px);
        }
        
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .btn-danger {
            background: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
        }
        
        .btn-danger:hover {
            opacity: 0.8;
        }
        
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .count {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.8em;
            font-weight: bold;
        }
        
        .empty {
            padding: 40px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        .icon {
            margin-right: 8px;
        }
        
        .collapsible {
            cursor: pointer;
            user-select: none;
        }
        
        .collapsed .section-content {
            display: none;
        }
        
        @media (max-width: 600px) {
            .item {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }
            
            .actions {
                width: 100%;
                justify-content: flex-end;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧹 Knip 代码清理分析结果</h1>
        <button class="btn btn-secondary" onclick="refresh()">🔄 重新扫描</button>
    </div>
    
    <div class="summary">
        <strong>📊 扫描摘要:</strong> 
        ${totalIssues === 0 ? 
            '🎉 恭喜！没有发现无用代码' : 
            `发现 <strong>${totalIssues}</strong> 个问题需要处理`
        }
    </div>
    
    ${this.generateFilesSection(unusedFiles)}
    ${this.generateDependenciesSection(unusedDeps, false)}
    ${this.generateDependenciesSection(unusedDevDeps, true)}
    ${this.generateExportsSection(unusedExports)}
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function deleteFile(filePath) {
            if (confirm(\`确定要删除文件吗？\\n\\n\${filePath}\\n\\n此操作不可撤销！\`)) {
                vscode.postMessage({
                    command: 'deleteFile',
                    filePath: filePath
                });
            }
        }
        
        function openFile(filePath) {
            vscode.postMessage({
                command: 'openFile',
                filePath: filePath
            });
        }
        
        function removeDependency(dep) {
            if (confirm(\`确定要从 package.json 中移除依赖吗？\\n\\n\${dep}\\n\\n建议先确认真的没有使用此依赖。\`)) {
                vscode.postMessage({
                    command: 'removeDependency',
                    dependency: dep
                });
            }
        }
        
        function removeDevDependency(dep) {
            if (confirm(\`确定要从 package.json 中移除开发依赖吗？\\n\\n\${dep}\\n\\n建议先确认真的没有使用此依赖。\`)) {
                vscode.postMessage({
                    command: 'removeDevDependency',
                    dependency: dep
                });
            }
        }
        
        function refresh() {
            vscode.postMessage({
                command: 'refresh'
            });
        }
        
        function toggleSection(sectionId) {
            const section = document.getElementById(sectionId);
            section.classList.toggle('collapsed');
        }
        
        // 添加键盘快捷键支持
        document.addEventListener('keydown', function(event) {
            if (event.ctrlKey && event.key === 'r') {
                event.preventDefault();
                refresh();
            }
        });
    </script>
</body>
</html>
        `;
    }

    private generateFilesSection(files: string[]): string {
        if (files.length === 0) {
            return `
                <div class="section">
                    <div class="section-header">
                        <span><span class="icon">📁</span>无用文件</span>
                        <span class="count">0</span>
                    </div>
                    <div class="empty">✅ 没有发现无用文件</div>
                </div>
            `;
        }

        const items = files.map(file => `
            <div class="item">
                <div class="item-info">
                    <div class="item-path">${file}</div>
                </div>
                <div class="actions">
                    <button class="btn btn-primary" onclick="openFile('${file}')">📝 查看</button>
                    <button class="btn btn-danger" onclick="deleteFile('${file}')">🗑️ 删除</button>
                </div>
            </div>
        `).join('');

        return `
            <div class="section" id="files-section">
                <div class="section-header collapsible" onclick="toggleSection('files-section')">
                    <span><span class="icon">📁</span>无用文件</span>
                    <span class="count">${files.length}</span>
                </div>
                <div class="section-content">
                    ${items}
                </div>
            </div>
        `;
    }

    private generateDependenciesSection(deps: string[], isDev: boolean): string {
        const title = isDev ? '🔧 无用开发依赖' : '📦 无用依赖';
        const actionName = isDev ? 'removeDevDependency' : 'removeDependency';

        if (deps.length === 0) {
            return `
                <div class="section">
                    <div class="section-header">
                        <span><span class="icon">${isDev ? '🔧' : '📦'}</span>${title}</span>
                        <span class="count">0</span>
                    </div>
                    <div class="empty">✅ 没有发现无用${isDev ? '开发' : ''}依赖</div>
                </div>
            `;
        }

        const items = deps.map(dep => `
            <div class="item">
                <div class="item-info">
                    <div class="item-path">${dep}</div>
                </div>
                <div class="actions">
                    <button class="btn btn-danger" onclick="${actionName}('${dep}')">🗑️ 移除</button>
                </div>
            </div>
        `).join('');

        return `
            <div class="section" id="${isDev ? 'dev-deps' : 'deps'}-section">
                <div class="section-header collapsible" onclick="toggleSection('${isDev ? 'dev-deps' : 'deps'}-section')">
                    <span><span class="icon">${isDev ? '🔧' : '📦'}</span>${title}</span>
                    <span class="count">${deps.length}</span>
                </div>
                <div class="section-content">
                    ${items}
                </div>
            </div>
        `;
    }

    private generateExportsSection(exports: Record<string, string[]>): string {
        const files = Object.keys(exports);
        
        if (files.length === 0) {
            return `
                <div class="section">
                    <div class="section-header">
                        <span><span class="icon">📤</span>无用导出</span>
                        <span class="count">0</span>
                    </div>
                    <div class="empty">✅ 没有发现无用导出</div>
                </div>
            `;
        }

        const items = files.map(file => {
            const exportList = exports[file];
            return `
                <div class="item">
                    <div class="item-info">
                        <div class="item-path">${file}</div>
                        <div class="item-exports">导出: ${exportList.join(', ')}</div>
                    </div>
                    <div class="actions">
                        <button class="btn btn-primary" onclick="openFile('${file}')">📝 查看</button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="section" id="exports-section">
                <div class="section-header collapsible" onclick="toggleSection('exports-section')">
                    <span><span class="icon">📤</span>无用导出</span>
                    <span class="count">${files.length}</span>
                </div>
                <div class="section-content">
                    ${items}
                </div>
            </div>
        `;
    }

    private async deleteFile(filePath: string, projectPath: string): Promise<void> {
        try {
            const fullPath = path.join(projectPath, filePath);
            const uri = vscode.Uri.file(fullPath);
            
            // 检查文件是否存在
            if (!fs.existsSync(fullPath)) {
                vscode.window.showWarningMessage(`文件不存在: ${filePath}`);
                return;
            }
            
            await vscode.workspace.fs.delete(uri);
            vscode.window.showInformationMessage(`✅ 已删除文件: ${filePath}`);
        } catch (error: any) {
            console.error('删除文件失败:', error);
            vscode.window.showErrorMessage(`❌ 删除文件失败: ${error.message}`);
        }
    }

    private async openFile(filePath: string, projectPath: string): Promise<void> {
        try {
            const fullPath = path.join(projectPath, filePath);
            const uri = vscode.Uri.file(fullPath);
            
            if (!fs.existsSync(fullPath)) {
                vscode.window.showWarningMessage(`文件不存在: ${filePath}`);
                return;
            }
            
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
        } catch (error: any) {
            console.error('打开文件失败:', error);
            vscode.window.showErrorMessage(`❌ 打开文件失败: ${error.message}`);
        }
    }

    private async removeDependency(dependency: string, projectPath: string, isDev: boolean): Promise<void> {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            
            if (!fs.existsSync(packageJsonPath)) {
                vscode.window.showErrorMessage('找不到 package.json 文件');
                return;
            }
            
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const depType = isDev ? 'devDependencies' : 'dependencies';
            
            if (packageJson[depType] && packageJson[depType][dependency]) {
                delete packageJson[depType][dependency];
                fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
                vscode.window.showInformationMessage(`✅ 已移除${isDev ? '开发' : ''}依赖: ${dependency}`);
            } else {
                vscode.window.showWarningMessage(`依赖不存在: ${dependency}`);
            }
        } catch (error: any) {
            console.error('移除依赖失败:', error);
            vscode.window.showErrorMessage(`❌ 移除依赖失败: ${error.message}`);
        }
    }
}