---
status: done
priority: P1
created: 2026-03-08
---

# 002 — 移除 OCR / 图片识别功能

## 背景

用户认为 OCR 和图片识别翻译功能使用率不高，决定移除以降低项目复杂度。

## 移除范围（执行确认后）

以下范围已完成依赖分析并执行删除：

### 已移除

- 本地 OCR（PaddleOCR Native Host）
- 图片文字识别翻译
- 漫画翻译（manga）
- `QwenVL` 相关运行时链路
- `rules.json` 与 DNR 请求头改写规则

### 已确认保留

- `offscreen/` 与 TTS 链路
- 文本翻译与沉浸式翻译
- PDF 入口
- 广告拦截

### 执行中确认的结论

- `src/core/qwenvl.js` 的实际可达用途集中在图片 / 漫画链路，已一并移除
- `background/modules/general_image.js` 只服务图片翻译入口，已一并移除
- 广告拦截未发现 OCR / 图片识别运行时依赖，保留
- `content/modules/state.js` 中的 `pendingTranslations` 仍被沉浸式翻译使用，因此保留

## 涉及文件（执行回填）

### 已整体删除的文件/目录

| 文件/目录 | 说明 |
|-----------|------|
| `native-host/` | 整个 Python 后端（OCR 专用） |
| `rules.json` | 漫画翻译使用的 DNR 规则 |
| `src/core/ocr.js` | OCR 管理器 |
| `src/core/native-ocr.js` | Native Messaging OCR 客户端 |
| `src/core/qwenvl.js` | QwenVL 视觉模型 |
| `content/modules/ocr.js` | OCR 前端交互 |
| `content/modules/manga.js` | 漫画模式 UI |
| `content/modules/translation-cache.js` | OCR / 漫画缓存模块 |
| `background/modules/manga.js` | 漫画后台处理 |
| `background/modules/general_image.js` | 图片翻译处理 |

### 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `manifest.json` | 移除 OCR / 漫画相关 content script、`nativeMessaging`、`declarativeNetRequest*` 与 `declarative_net_request` |
| `background/service-worker.js` | 移除 OCR / manga / image 相关消息处理和 import |
| `content/content.js` | 移除 `ocrImage`、`startOCR`、`toggleMangaMode` 相关消息入口 |
| `content/modules/state.js` | 移除漫画专属状态，保留沉浸式翻译仍使用的 `pendingTranslations` |
| `src/core/translator.js` | 移除 `QwenVL` 引擎注册 |
| `src/core/storage.js` | 移除 OCR/manga 相关默认设置字段 |
| `options/options.html` | 移除 OCR、漫画翻译、Native Host 配置区域 |
| `options/options.js` | 移除对应设置逻辑 |
| `popup/popup.html` / `popup/popup.js` | 移除图片翻译和漫画翻译入口 |
| `background/modules/menus.js` | 移除“翻译图片”右键菜单项 |
| `README.md` 与 `docs/*.md` | 同步更新为无 OCR / 漫画 / Native Host 的当前架构说明 |

## 执行要求与完成情况

1. [x] 先完成依赖分析，并写入 [reports/002-remove-ocr.md](../reports/002-remove-ocr.md)
2. [x] 人工确认后执行删除，而不是在分析阶段直接动手
3. [x] 按模块移除运行时代码、入口、权限、配置和死引用
4. [x] 保留文本翻译、沉浸式翻译、TTS、PDF、广告拦截等非 OCR 功能
5. [x] 同步更新正式文档与 workbench 报告

## 相关文档

- 讨论: [discussions/002-remove-ocr.md](../discussions/002-remove-ocr.md)
- 报告: [reports/002-remove-ocr.md](../reports/002-remove-ocr.md)
