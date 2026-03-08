# 开发指南

## 环境准备

### 加载扩展

1. 克隆项目到本地
2. 打开 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」→ 选择项目根目录

### 开发工具

- Chrome DevTools — 调试内容脚本和弹窗
- `chrome://extensions/` → Service Worker「检查视图」 — 调试后台脚本
- `chrome://extensions/` → 「错误」 — 查看扩展错误日志

## 项目约定

### 代码风格

- JavaScript: ES6+ Modules, 无构建工具
- 缩进: 4 空格
- 命名: camelCase（变量/函数）, UPPER_SNAKE_CASE（常量）
- 模块通过 `window.SmartTranslator` 命名空间通信

### 文件组织

- 新增翻译引擎 → `src/core/` 下新建模块，在 `translator.js` 中注册
- 新增内容脚本功能 → `content/modules/` 下新建模块，在 `manifest.json` 中添加
- 新增后台消息处理 → `background/modules/` 下新建模块，在 `service-worker.js` 中引入

### 消息协议

所有 `chrome.runtime.sendMessage` 使用统一格式：

```javascript
// 请求
{ action: "translate", text: "hello", provider: "openai", targetLang: "zh" }

// 响应
{ success: true, result: "你好" }
// 或
{ success: false, error: "API key not configured" }
```

## 调试方法

### 内容脚本

在目标页面按 F12 打开 DevTools → Console，输入：

```javascript
// 查看全局状态
window.SmartTranslator

// 手动触发翻译
chrome.runtime.sendMessage({ action: 'translate', text: 'test', targetLang: 'zh' })
```

### Service Worker

`chrome://extensions/` → 智译 → 「Service Worker」链接 → 打开 DevTools

### 弹窗

右键扩展图标 → 「检查弹出内容」

### Native Host

```bash
# 测试 Native Messaging 通信
cd native-host
python3 test_native.py

# 测试 API 服务
python3 test_api_internal.py
```

## 发布构建

当前无自动化构建流程。发布步骤：

1. 更新 `manifest.json` 中的 `version`
2. 确认 `config.txt` 不包含真实密钥
3. 打包为 `.zip`（排除 `_metadata/`、`native-host/test_data/`、`.git/`、`docs/`）
4. 上传至 Chrome Web Store

## 添加新翻译引擎

1. 在 `src/core/` 下创建引擎模块（参考 `openai.js` 结构）
2. 导出异步翻译函数
3. 在 `src/core/translator.js` 中引入并注册到引擎映射表
4. 在 `options/options.html` 中添加配置 UI
5. 在 `src/core/storage.js` 中添加默认配置字段
