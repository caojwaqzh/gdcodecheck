import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class ConfigManager {
    async openConfig(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('请先打开一个项目文件夹');
            return;
        }

        const configFiles = [
            'knip.config.ts',
            'knip.config.js',
            'knip.json',
            '.kniprc.json'
        ];

        let configFile: string | undefined;
        for (const file of configFiles) {
            const fullPath = path.join(workspaceFolder.uri.fsPath, file);
            if (fs.existsSync(fullPath)) {
                configFile = fullPath;
                break;
            }
        }

        if (!configFile) {
            const choice = await vscode.window.showInformationMessage(
                '没有找到 Knip 配置文件，是否创建一个？',
                '创建配置',
                '取消'
            );

            if (choice === '创建配置') {
                configFile = await this.createConfig(workspaceFolder.uri.fsPath);
            } else {
                return;
            }
        }

        if (configFile) {
            const uri = vscode.Uri.file(configFile);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
        }
    }

    private async createConfig(projectPath: string): Promise<string> {
        const configPath = path.join(projectPath, 'knip.config.ts');
        
        // 分析项目结构来生成更合适的配置
        const packageJsonPath = path.join(projectPath, 'package.json');
        let entryPoints = ['src/index.ts', 'src/main.tsx', 'src/main.ts', 'src/app.ts'];
        
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                if (packageJson.main) {
                    entryPoints.unshift(packageJson.main);
                }
                if (packageJson.types) {
                    entryPoints.push(packageJson.types);
                }
            } catch (error) {
                console.error('解析 package.json 失败:', error);
            }
        }

        const defaultConfig = `import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // 入口文件 - Knip 从这些文件开始分析
  entry: [
    ${entryPoints.map(entry => `'${entry}'`).join(',\n    ')}
  ],
  
  // 项目文件匹配模式
  project: ['src/**/*.{ts,tsx,js,jsx}'],
  
  // 忽略的文件和目录
  ignore: [
    'dist/**',
    'build/**',
    'coverage/**',
    'node_modules/**',
    '**/*.test.{ts,tsx,js,jsx}',
    '**/*.spec.{ts,tsx,js,jsx}',
    '**/*.d.ts',
    '**/*.stories.{ts,tsx,js,jsx}',
    'vite.config.*',
    'webpack.config.*',
    'rollup.config.*'
  ],
  
  // 忽略的依赖 - 即使没有直接引用也保留
  ignoreDependencies: [
    // 类型定义
    '@types/*',
    // 构建工具
    'vite',
    'webpack',
    'rollup',
    // 测试工具
    'jest',
    'vitest',
    '@testing-library/*',
    // 开发工具
    'eslint',
    'prettier',
    'typescript'
  ],
  
  // 忽略的导出 - 这些导出不会被标记为未使用
  ignoreExportsUsedInFile: true,
  
  // 工作区配置（如果是 monorepo）
  // workspaces: {
  //   'packages/*': {
  //     entry: 'src/index.ts'
  //   }
  // }
};

export default config;
`;

        fs.writeFileSync(configPath, defaultConfig, 'utf8');
        vscode.window.showInformationMessage('✅ 已创建 Knip 配置文件');
        
        return configPath;
    }
}