# GD 代码清理器

🧹 基于 Knip 的 VSCode 插件，帮助您检测和清理 JavaScript/TypeScript 项目中的无用代码和依赖。

## ✨ 功能特性

- 🔍 **智能检测**: 自动识别无用文件、依赖和导出
- 🎯 **精准分析**: 基于 Knip 的强大分析能力
- 🖼️ **可视化界面**: 友好的结果展示和操作界面
- ⚡ **快速清理**: 一键删除无用代码
- ⚙️ **灵活配置**: 支持自定义 Knip 配置
- 🛡️ **安全操作**: 删除前确认，支持撤销

## 🚀 快速开始

1. 安装插件
2. 打开您的 TypeScript/JavaScript 项目
3. 在项目根目录安装 Knip: `npm install -D knip`
4. 点击状态栏的 "Knip" 按钮或使用命令面板 (Ctrl+Shift+P) 搜索 "Knip: 扫描无用代码"

## 📋 使用方法

### 扫描无用代码
- 点击状态栏的 Knip 按钮
- 或使用命令面板: `Knip: 扫描无用代码`
- 或右键项目文件夹选择相应选项

### 查看结果
扫描完成后会显示详细的分析结果，包括：
- 📁 无用文件
- 📦 无用依赖
- 🔧 无用开发依赖  
- 📤 无用导出

### 清理代码
- 在结果面板中选择性处理问题
- 或使用 `Knip: 清理无用代码` 命令批量清理

## ⚙️ 配置

插件会自动创建 `knip.config.ts` 配置文件，您也可以手动配置：

```typescript
import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/index.ts'],
  project: ['src/**/*.{ts,tsx}'],
  ignore: ['**/*.test.ts', 'dist/**'],
};

export default config;
```