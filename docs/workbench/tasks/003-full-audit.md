---
status: done
priority: P1
created: 2026-03-08
---

# 003 — 全面审核计划

> 本计划供 Codex 逐步执行。每个任务独立，可并行或串行完成。
> 审核完成后，将所有发现汇总到 `docs/workbench/reports/003-full-audit.md`。

---

## 一、安全审核

### 1.1 API 密钥与敏感信息泄露
- [ ] 检查 `config.txt` 是否包含真实 API 密钥，是否被 `.gitignore` 排除
- [ ] 扫描所有 JS 文件，查找硬编码的 API 密钥、密码、token（正则：`/['"](sk-|key-|AIza|ghp_|ghu_)/`）
- [ ] 检查 `manifest.json` 中的 `host_permissions` 是否过于宽泛（当前为 `<all_urls>`）
- [x] 确认 Native Host 相关配置文件已随 `002-remove-ocr` 删除，不再存在 `allowed_origins` 暴露面

### 1.2 XSS 与注入风险
- [ ] 审核所有 `innerHTML`、`outerHTML` 赋值操作，检查是否对用户输入或翻译结果做了转义
  - 重点文件：`content/modules/sidebar.js`、`content/modules/float-window.js`、`popup/popup.js`、`options/options.js`、`content/modules/selection.js`
- [ ] 检查 `document.createElement` 后是否安全设置属性（vs 直接拼接 HTML）
- [ ] 审查所有 `eval()`、`Function()`、`setTimeout(string)` 的使用
- [ ] 检查 CSP (Content Security Policy) 配置是否在 manifest.json 中正确设置

### 1.3 网络请求安全
- [ ] 检查所有 `fetch()` 调用是否使用 HTTPS
- [x] 确认 `rules.json` 与 `declarativeNetRequest` 相关配置已随 `002-remove-ocr` 删除，不再存在请求头改写规则
- [ ] 检查 API 请求是否有适当的错误处理，不会在错误消息中泄露敏感信息
- [ ] 审查 `src/core/openai.js`、`src/core/gemini.js`、`src/core/deepseek.js` 中的请求构建

### 1.4 Chrome Extension 安全最佳实践
- [ ] 检查 `permissions` 是否遵循最小权限原则（当前：activeTab, storage, contextMenus, scripting, offscreen）
- [ ] 检查内容脚本是否正确隔离，不与页面上下文混合
- [ ] 审查 `chrome.runtime.onMessage` 处理器是否验证 `sender` 来源
- [ ] 检查 `chrome.scripting.executeScript` 的使用是否安全

### 1.5 Native Host / OCR 残留面（已移除）
- [x] 确认 `native-host/` 已删除
- [x] 确认 `nativeMessaging` 权限已移除
- [x] 确认仓库内无运行时 OCR 宿主调用残留

---

## 二、代码质量审核

### 2.1 JavaScript 代码规范
- [ ] 检查是否有未使用的变量、函数、import
- [ ] 检查 `var` 使用情况，建议改为 `const`/`let`
- [ ] 检查 `==` vs `===` 的一致使用
- [ ] 检查函数长度，标记超过 100 行的函数
- [ ] 检查嵌套深度，标记超过 4 层嵌套的代码块
- [ ] 检查是否有重复代码（DRY 原则）
  - 重点关注：各翻译引擎模块（openai.js, gemini.js, deepseek.js）之间的重复逻辑

### 2.2 已移除 Python 侧代码（不适用）
- [x] `native-host/` 已随 `002-remove-ocr` 删除，本节不再适用

### 2.3 全局状态管理
- [ ] 审查 `window.SmartTranslator` 全局命名空间的使用
- [ ] 检查 `content/modules/state.js` 的状态管理是否有竞态条件风险
- [x] `mangaQueue` 与 `translatedImages` 已随 `002-remove-ocr` 删除，不再适用
- [ ] 审查 `pendingTranslations` Set 的内存管理

### 2.4 模块化与架构
- [ ] 检查模块间的循环依赖
- [ ] 评估 `service-worker.js` 的职责是否过重（消息路由 + 业务逻辑）
- [ ] 检查 content script 模块之间的耦合度
- [ ] 评估 `src/core/` 中各翻译引擎是否可以抽象出统一接口

---

## 三、错误处理与健壮性

### 3.1 异步错误处理
- [ ] 检查所有 `async/await` 是否有 `try/catch`
- [ ] 检查所有 `Promise` 是否有 `.catch()` 处理
- [ ] 检查 `fetch()` 调用是否处理网络错误和非 200 状态码
- [ ] 检查 `chrome.runtime.lastError` 是否在回调中正确检查

### 3.2 边界条件
- [ ] 检查空值/undefined 处理（翻译结果为空、API 返回异常格式）
- [ ] 检查 Chrome Storage 配额限制处理（`storage.local` 有 10MB 限制）
- [ ] 检查历史记录 500 条上限的边界处理
- [ ] 检查大文本翻译的分片/截断逻辑
- [x] 图片 OCR / 漫画翻译边界条件已随 `002-remove-ocr` 删除，不再适用

### 3.3 超时与重试
- [ ] 检查 API 调用是否有超时设置
- [ ] 检查翻译失败后的重试策略
- [x] Native Messaging 通信已移除，不再适用
- [ ] 检查 TTS 服务不可用时的降级处理

---

## 四、性能审核

### 4.1 内容脚本性能
- [ ] 检查内容脚本对页面性能的影响（8 个模块在所有 URL 上加载）
- [ ] 检查 DOM 操作是否有批量处理（避免频繁 reflow）
- [ ] 检查事件监听器是否有适当的 debounce/throttle
- [ ] 检查 `content/modules/immersive.js` 沉浸式翻译对大页面的性能影响
- [ ] 检查 `MutationObserver` 的使用是否高效

### 4.2 内存管理
- [ ] 检查事件监听器是否正确清理（页面卸载时）
- [x] `translation-cache.js` 已随 `002-remove-ocr` 删除，不再适用
- [ ] 检查 `Set` 和 `Map` 是否有清理机制，防止内存泄漏
- [ ] 检查 sidebar/float-window 关闭时是否正确释放资源

### 4.3 网络性能
- [ ] 检查翻译请求是否有请求合并/批处理优化
- [ ] 检查是否有不必要的重复 API 调用
- [ ] 检查 `translateBatch` 批量翻译的并发控制
- [x] 图片翻译预处理链路已随 `002-remove-ocr` 删除，不再适用

### 4.4 Service Worker 性能
- [ ] 检查 Service Worker 唤醒时间和效率
- [ ] 检查 `chrome.storage` 读写频率是否合理
- [ ] 检查消息传递是否有不必要的序列化开销

### 4.5 已移除 Python 后端（不适用）
- [x] `native-host/` 已随 `002-remove-ocr` 删除，本节不再适用

---

## 五、功能完整性审核

### 5.1 翻译引擎
- [ ] 验证每个翻译引擎（Google Free, OpenAI, Gemini, DeepSeek, Offline）的基本功能完整性
- [ ] 检查引擎切换逻辑是否正确
- [ ] 检查自动语言检测是否可靠
- [ ] 检查离线翻译的词典覆盖和回退逻辑

### 5.2 UI 功能
- [ ] 审查 popup 页面所有交互元素的功能完整性
- [ ] 审查 options 页面所有设置项是否正确保存和应用
- [ ] 检查侧边栏（sidebar）的打开/关闭/调整大小
- [ ] 检查浮动窗口（float-window）的定位和拖拽
- [ ] 检查浮动球（floating-ball）的行为

### 5.3 高级功能
- [ ] 审查沉浸式翻译模式的实现完整性
- [x] 漫画翻译流程已随 `002-remove-ocr` 删除，不再适用
- [ ] 审查 TTS 功能（多引擎切换、音频播放控制）
- [ ] 审查 PDF 翻译功能
- [ ] 审查广告拦截功能（`ad-blocker.js`）

### 5.4 快捷键与上下文菜单
- [ ] 验证 4 个键盘快捷键（Alt+T, Alt+I, Alt+S, Alt+W）是否正确绑定和执行
- [ ] 验证右键菜单项是否正确创建和响应

---

## 六、兼容性审核

### 6.1 浏览器兼容性
- [ ] 确认 Manifest V3 API 使用是否符合最新 Chrome 标准
- [ ] 检查是否使用了已废弃的 Chrome API
- [ ] 检查 ES6+ 语法兼容性（Chrome 最低版本要求）

### 6.2 页面兼容性
- [ ] 检查内容脚本是否会与常见网站冲突（CSS 命名空间隔离）
- [ ] 检查 Shadow DOM 的使用情况（如果有）
- [ ] 检查 iframe 中的翻译支持
- [ ] 检查 SPA（单页应用）中的翻译持久性

### 6.3 已移除 Python 后端（不适用）
- [x] `native-host/` 已随 `002-remove-ocr` 删除，本节不再适用

---

## 七、用户体验审核

### 7.1 界面设计
- [ ] 检查暗色模式/亮色模式切换的完整性（`theme.css`）
- [ ] 检查 UI 文案的一致性和准确性
- [ ] 检查加载状态指示器（翻译中、TTS 中等）
- [ ] 检查错误提示的用户友好性

### 7.2 可访问性
- [ ] 检查 ARIA 属性的使用
- [ ] 检查键盘导航支持
- [ ] 检查颜色对比度
- [ ] 检查字体大小的可调性

### 7.3 国际化
- [ ] 检查 `_locales/zh_CN/messages.json` 的完整性
- [ ] 检查是否有硬编码的中文字符串未走 i18n
- [ ] 检查是否支持其他语言的 UI

---

## 八、数据管理审核

### 8.1 存储
- [ ] 审查 `src/core/storage.js` 的数据结构设计
- [ ] 检查设置导入/导出功能的完整性
- [ ] 检查数据迁移策略（版本升级时旧数据兼容）
- [ ] 检查 Chrome Storage 写入冲突处理

### 8.2 缓存
- [x] 独立翻译缓存模块 `translation-cache.js` 已随 `002-remove-ocr` 删除，本节不再适用

### 8.3 历史记录与收藏
- [ ] 检查历史记录的增删查逻辑
- [ ] 检查收藏功能的同步行为
- [ ] 检查数据去重策略

---

## 九、部署与维护审核

### 9.1 构建与发布
- [ ] 检查是否有自动化构建/打包流程
- [ ] 检查是否有版本号管理策略

### 9.2 测试覆盖
- [ ] 评估现有测试覆盖率（当前未见自动化测试）
- [ ] 建议添加 JS 单元测试框架（如 Jest）
- [ ] 建议关键模块的测试用例清单
- [ ] 建议 E2E 测试方案（如 Puppeteer + Chrome Extension Testing）

### 9.3 日志与监控
- [ ] 检查 `console.log` 的使用是否需要清理或分级
- [ ] 建议生产环境日志策略
- [ ] 检查错误上报机制

### 9.4 文档
- [x] 检查现有 README.md 是否覆盖安装、配置、使用说明
- [x] 检查现有开发者文档是否覆盖架构图、模块说明
- [x] 检查现有 API 密钥配置指南是否完整
- [x] 检查现有 native-host 文档是否已转为“已移除功能”的历史说明

---

## 执行说明

### 优先级排序
1. **P0 - 安全审核**（第一部分）：最高优先级，直接影响用户数据安全
2. **P1 - 错误处理**（第三部分）：影响稳定性
3. **P1 - 性能审核**（第四部分）：影响用户体验
4. **P2 - 代码质量**（第二部分）：影响可维护性
5. **P2 - 功能完整性**（第五部分）：确保功能正确
6. **P3 - 其余部分**：改进性建议

### 输出格式
对每个检查项，按以下格式记录发现：

```markdown
#### [检查项编号] 检查项名称
- **状态**: PASS / WARN / FAIL
- **严重性**: Critical / High / Medium / Low / Info
- **位置**: 文件路径:行号
- **发现**: 具体问题描述
- **建议**: 修复方案
```

### 关键文件路径快速索引

| 类别 | 文件 |
|------|------|
| 扩展配置 | `manifest.json`, `config.txt` |
| 弹窗 UI | `popup/popup.html`, `popup/popup.js`, `popup/popup.css` |
| 设置页 | `options/options.html`, `options/options.js`, `options/options.css`, `options/theme.css` |
| 后台服务 | `background/service-worker.js`, `background/modules/*.js` |
| 内容脚本 | `content/content.js`, `content/modules/*.js` |
| 核心模块 | `src/core/*.js` (translator, storage, openai, gemini, deepseek, tts, pdf, offline, google-free) |
| 离屏文档 | `offscreen/offscreen.html`, `offscreen/offscreen.js` |
