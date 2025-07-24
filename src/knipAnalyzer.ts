import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface KnipResult {
    files?: string[];
    dependencies?: string[];
    devDependencies?: string[];
    exports?: Record<string, string[]>;
    types?: Record<string, string[]>;
}

export type ProgressCallback = (message: string, increment: number) => boolean;

export class KnipAnalyzer {
    async analyze(projectPath: string, progress?: ProgressCallback): Promise<KnipResult | null> {
        try {
            // 检查是否安装了 knip
            if (!this.isKnipInstalled(projectPath)) {
                throw new Error('Knip 未安装。请运行: npm install -D knip');
            }

            progress?.('检查配置文件...', 10);
            await this.ensureConfig(projectPath);

            progress?.('运行 Knip 分析...', 30);
            const result = execSync('npx knip --reporter json', {
                cwd: projectPath,
                encoding: 'utf8',
                timeout: 60000 // 60秒超时
            });

            progress?.('解析结果...', 80);
            
            if (!result.trim()) {
                return {
                    files: [],
                    dependencies: [],
                    devDependencies: [],
                    exports: {},
                    types: {}
                };
            }

            const knipResult: KnipResult = JSON.parse(result);
            progress?.('分析完成', 100);
            
            return knipResult;
        } catch (error: any) {
            if (error.message.includes('Command failed')) {
                // Knip 可能返回非零退出码，但仍有有效输出
                try {
                    const output = error.stdout || error.output?.[1];
                    if (output) {
                        return JSON.parse(output.toString());
                    }
                } catch (parseError) {
                    // 解析失败，继续抛出原错误
                }
            }
            throw error;
        }
    }

    async clean(projectPath: string): Promise<void> {
        try {
            execSync('npx knip --fix', {
                cwd: projectPath,
                encoding: 'utf8',
                timeout: 120000 // 2分钟超时
            });
        } catch (error: any) {
            // knip --fix 可能返回非零退出码，检查是否有实际错误
            if (!error.message.includes('files removed') && 
                !error.message.includes('dependencies removed')) {
                throw error;
            }
        }
    }

    private isKnipInstalled(projectPath: string): boolean {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                return false;
            }

            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            return !!(packageJson.dependencies?.knip || packageJson.devDependencies?.knip);
        } catch {
            return false;
        }
    }

    private async ensureConfig(projectPath: string): Promise<void> {
        const configFiles = [
            'knip.config.ts',
            'knip.config.js',
            'knip.json',
            '.kniprc.json'
        ];

        const hasConfig = configFiles.some(file => 
            fs.existsSync(path.join(projectPath, file))
        );

        if (!hasConfig) {
            await this.createDefaultConfig(projectPath);
        }
    }

    private async createDefaultConfig(projectPath: string): Promise<void> {
        const configPath = path.join(projectPath, 'knip.config.ts');
        const defaultConfig = `import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/index.ts',
    'src/main.tsx',
    'src/main.ts',
    'src/app.ts'
  ],
  project: ['src/**/*.{ts,tsx,js,jsx}'],
  ignore: [
    'dist/**',
    'build/**',
    'coverage/**',
    '**/*.test.{ts,tsx,js,jsx}',
    '**/*.spec.{ts,tsx,js,jsx}',
    '**/*.d.ts'
  ],
  ignoreDependencies: [
    // 根据需要添加要忽略的依赖
  ]
};

export default config;
`;

        fs.writeFileSync(configPath, defaultConfig, 'utf8');
    }
}