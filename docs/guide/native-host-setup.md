# Native Host 说明（已移除）

## 状态

自 2026-03-09 起，智译已移除以下能力：

- 图片 OCR 翻译
- 漫画翻译
- Native Messaging 本地 OCR 宿主
- `native-host/` Python 目录及相关权限

因此，当前版本**不再需要**安装 Native Host，也不会再读取或调用本地 OCR 服务。

## 当前替代情况

- 文本翻译仍由浏览器扩展前端完成
- 语音朗读仍通过 Offscreen Document 与 TTS 服务完成
- PDF 模块代码仍保留，但当前未开放入口

## 历史说明

本文件保留为历史记录，便于解释为什么仓库中不再存在 `native-host/`、`rules.json`、`nativeMessaging` 等相关内容。

如果未来要恢复 OCR / 漫画翻译能力，应先从 Git 历史恢复对应实现，再重新编写安装与部署文档。
