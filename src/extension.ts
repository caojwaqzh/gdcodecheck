import * as vscode from 'vscode';
import { KnipAnalyzer } from './knipAnalyzer';
import { ResultsPanel } from './resultsPanel';
import { ConfigManager } from './configManager'; 

let analyzer: KnipAnalyzer;
let resultsPanel: ResultsPanel;
let configManager: ConfigManager;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Knip Code Cleaner 插件已激活');

    // 初始化组件
    analyzer = new KnipAnalyzer();
    resultsPanel = new ResultsPanel(context);
    configManager = new ConfigManager();

    // 注册命令
    const scanCommand = vscode.commands.registerCommand(
        'knip-cleaner.scan',
        async (uri?: vscode.Uri) => {
            await handleScan(uri);
        }
    );

    const cleanCommand = vscode.commands.registerCommand(
        'knip-cleaner.clean',
        async () => {
            await handleClean();
        }
    );

    const configCommand = vscode.commands.registerCommand(
        'knip-cleaner.config',
        async () => {
            await configManager.openConfig();
        }
    );

    // 创建状态栏项目
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = '$(search) Knip';
    statusBarItem.command = 'knip-cleaner.scan';
    statusBarItem.tooltip = '扫描无用代码';
    statusBarItem.show();

    // 监听配置变化
    const configWatcher = vscode.workspace.onDidChangeConfiguration(
        (event) => {
            if (event.affectsConfiguration('knip')) {
                vscode.window.showInformationMessage('Knip 配置已更新');
            }
        }
    );

    // 自动扫描
    const config = vscode.workspace.getConfiguration('knip');
    if (config.get('autoScan')) {
        setTimeout(() => handleScan(), 2000);
    }

    // 注册所有可释放资源
    context.subscriptions.push(
        scanCommand,
        cleanCommand,
        configCommand,
        statusBarItem,
        configWatcher
    );
}

async function handleScan(uri?: vscode.Uri): Promise<void> {
    const workspaceFolder = getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('请先打开一个项目文件夹');
        return;
    }

    try {
        const config = vscode.workspace.getConfiguration('knip');
        const showNotifications = config.get('showNotifications', true);

        if (showNotifications) {
            vscode.window.showInformationMessage('正在扫描无用代码...');
        }

        const results = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: '扫描无用代码',
                cancellable: true
            },
            async (progress, token) => {
                progress.report({ increment: 0, message: '初始化...' });
                
                const results = await analyzer.analyze(workspaceFolder.uri.fsPath, (message, increment) => {
                    progress.report({ increment, message });
                    return !token.isCancellationRequested;
                });

                return results;
            }
        );

        if (results) {
            await resultsPanel.show(results, workspaceFolder.uri.fsPath);
            
            if (showNotifications) {
                const totalIssues = (results.files?.length || 0) + 
                                 (results.dependencies?.length || 0) + 
                                 (results.devDependencies?.length || 0);
                vscode.window.showInformationMessage(
                    `扫描完成！发现 ${totalIssues} 个问题`
                );
            }
        }
    } catch (error: any) {
        console.error('扫描失败:', error);
        vscode.window.showErrorMessage(`扫描失败: ${error.message}`);
    }
}

async function handleClean(): Promise<void> {
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('请先打开一个项目文件夹');
        return;
    }

    const choice = await vscode.window.showWarningMessage(
        '这将自动清理所有检测到的无用代码，确定继续吗？\n建议先运行扫描查看具体内容。',
        { modal: true },
        '确定清理',
        '先扫描',
        '取消'
    );

    if (choice === '先扫描') {
        await handleScan();
        return;
    }

    if (choice !== '确定清理') {
        return;
    }

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: '清理无用代码',
                cancellable: false
            },
            async (progress) => {
                progress.report({ increment: 0, message: '清理中...' });
                await analyzer.clean(workspaceFolder.uri.fsPath);
                progress.report({ increment: 100, message: '完成' });
            }
        );

        vscode.window.showInformationMessage('代码清理完成！');
    } catch (error: any) {
        console.error('清理失败:', error);
        vscode.window.showErrorMessage(`清理失败: ${error.message}`);
    }
}

function getWorkspaceFolder(uri?: vscode.Uri): vscode.WorkspaceFolder | undefined {
    if (uri) {
        return vscode.workspace.getWorkspaceFolder(uri);
    }
    return vscode.workspace.workspaceFolders?.[0];
}

export function deactivate() {
    console.log('Knip Code Cleaner 插件已停用');
}