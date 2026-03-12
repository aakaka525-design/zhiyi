# 006 — 死代码清理与文档修正报告

- 状态: done
- 对应任务: [tasks/006-cleanup.md](../tasks/006-cleanup.md)
- 来源讨论: [discussions/005-product-surface.md](../discussions/005-product-surface.md)
- 执行日期: 2026-03-10

## 结果概览

本轮完成了 3 类收尾清理：

- 删除完全未接入、且实现模型已经过时的 `src/core/tts.js`
- 删除 `testTTS` 后台死路由，保留仍在使用的 TTS 音频生成与 offscreen 播放链路
- 修正因 005 和本轮删除动作带来的正式文档失配

## 已完成清理

### 6.1 删除 `src/core/tts.js`

- 删除了 [tts.js](/Users/xa/Desktop/projiect/zhiyi/src/core/tts.js)
- 删除前复核了 4 层可达性：
  - manifest 无入口
  - HTML 无 script 加载
  - 静态导出无消费方
  - 全仓无 `import()`

### 6.2 清理 `testTTS` 死路由

- [service-worker.js](/Users/xa/Desktop/projiect/zhiyi/background/service-worker.js) 移除了 `handleTestTTS` import 和 `case 'testTTS'`
- [tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) 删除了 `handleTestTTS()`
- 保留了 [tts.js](/Users/xa/Desktop/projiect/zhiyi/background/modules/tts.js) 中仍在使用的：
  - `playAudioViaOffscreen()`
  - `handleTTSOpenAI()`
  - `handleTTSGoogle()`
  - `handleTTSGLM()`

### 6.3 同步修正文档

- [native-host-setup.md](/Users/xa/Desktop/projiect/zhiyi/docs/guide/native-host-setup.md) 不再声明“PDF 入口保持不变”，改为“PDF 模块代码仍保留，但当前未开放入口”
- [project-structure.md](/Users/xa/Desktop/projiect/zhiyi/docs/reference/project-structure.md) 移除了已删除的 `src/core/tts.js`，并同步修正模块数量统计
- [architecture.md](/Users/xa/Desktop/projiect/zhiyi/docs/reference/architecture.md) 移除了已失效的 `testTTS` action，补成当前真实的 TTS 消息流（`ttsOpenAI` / `ttsGoogle` / `ttsGLM` / `playAudioOffscreen`）

## 验证

执行通过：

```bash
rg -n "src/core/tts\.js|TTSService|TTS_PROVIDERS|OPENAI_VOICES" . -g '*.js' -g '*.html' -g '*.json' -g '*.md'
rg -n "import\(" . -g '*.js' -g '*.html'
rg -n "action.*testTTS|testTTS.*action" popup options src content -g '*.js'
rg -n "case 'testTTS'|handleTestTTS" background/service-worker.js background/modules/tts.js
find background content popup options src offscreen -name '*.js' -type f | sort | xargs -n1 node --check
git diff --check
```

验证结论：

- `src/core/tts.js`、`TTSService`、`TTS_PROVIDERS`、`OPENAI_VOICES` 在运行时代码中已无残留引用；扫描命中只剩 workbench 历史文档
- 全仓仍然没有动态 `import()`
- 前端代码中已无 `action: 'testTTS'` 调用
- 后台代码中已无 `testTTS` 路由和 `handleTestTTS`
- 所有现存 JS 文件 `node --check` 通过
- `git diff --check` 无输出

## 未做项

- 没有做真实 Chrome 扩展环境手工点测
- 没有处理更大范围的 TTS 重构；当前只是删除死代码和过时实现
