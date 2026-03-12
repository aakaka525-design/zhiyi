# 005 — 产品表面清理报告

- 状态: done
- 对应任务: [tasks/005-product-surface.md](../tasks/005-product-surface.md)
- 对应讨论: [discussions/005-product-surface.md](../discussions/005-product-surface.md)
- 执行日期: 2026-03-10

## 结果概览

本轮完成了 5 类低风险、高感知的产品表面修复：

- 隐藏 Popup 中不可用的 PDF 入口
- 让 Popup 朗读遵循当前 `ttsProvider`
- 把离线翻译限制明确为“仅英译中”，并去掉静默回退
- 让 Options 页的“测试语音”执行真实播放链路
- 提供 `config.example.txt` 模板并补充配置说明

## 已完成修复

### 5.1 PDF 伪入口隐藏

- 删除了 [popup.html](/Users/xa/Desktop/projiect/zhiyi/popup/popup.html) 中的 `btn-pdf`
- 移除了 [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 里跳转 `options/options.html#pdf` 的事件
- 同步移除了 [manifest.json](/Users/xa/Desktop/projiect/zhiyi/manifest.json) 的 PDF 描述
- 保留 [pdf.js](/Users/xa/Desktop/projiect/zhiyi/src/core/pdf.js) 不动，后续仍可单独实现

### 5.2 Popup 朗读统一走 TTS 配置

- [popup.js](/Users/xa/Desktop/projiect/zhiyi/popup/popup.js) 的 `speak()` 改为按 `ttsProvider` 分发
- `system` 继续本地 `speechSynthesis`
- `openai` / `google` / `glm` 通过后台 `tts*` action 获取音频，再走 `playAudioOffscreen`
- Popup 不再固定退回系统语音

### 5.3 离线翻译声明修正

- [offline.js](/Users/xa/Desktop/projiect/zhiyi/src/core/offline.js) 只保留 `en-zh` 词典
- [translator.js](/Users/xa/Desktop/projiect/zhiyi/src/core/translator.js) 在用户显式选择 `offline` 时不再静默回退到 Google
- [options.html](/Users/xa/Desktop/projiect/zhiyi/options/options.html) 把离线选项标成“仅英译中”
- [README.md](/Users/xa/Desktop/projiect/zhiyi/README.md), [getting-started.md](/Users/xa/Desktop/projiect/zhiyi/docs/guide/getting-started.md), [api-configuration.md](/Users/xa/Desktop/projiect/zhiyi/docs/guide/api-configuration.md) 已同步修正文案

### 5.4 testTTS 真实播放

- [options.js](/Users/xa/Desktop/projiect/zhiyi/options/options.js) 的 `testTTS()` 现在会真实请求并播放
- `system` 使用页面内 `speechSynthesis`
- `openai` / `google` / `glm` 使用真实 `tts*` 请求，再调用 `playAudioOffscreen`
- 状态文案改为“正在测试...”和“已开始播放”

### 5.5 config.example.txt

- 新增 [config.example.txt](/Users/xa/Desktop/projiect/zhiyi/config.example.txt)
- 确认 [.gitignore](/Users/xa/Desktop/projiect/zhiyi/.gitignore) 已排除真实 `config.txt`
- [api-configuration.md](/Users/xa/Desktop/projiect/zhiyi/docs/guide/api-configuration.md) 已补充从 example 复制的说明

## 同步更新的正式文档

- [README.md](/Users/xa/Desktop/projiect/zhiyi/README.md)
- [getting-started.md](/Users/xa/Desktop/projiect/zhiyi/docs/guide/getting-started.md)
- [api-configuration.md](/Users/xa/Desktop/projiect/zhiyi/docs/guide/api-configuration.md)
- [features.md](/Users/xa/Desktop/projiect/zhiyi/docs/reference/features.md)

## 验证

执行通过：

```bash
find popup options src background offscreen -name '*.js' -type f -print0 | xargs -0 -n1 node --check
git diff --check
python3 - <<'PY'
from pathlib import Path
assert Path('config.example.txt').exists()
assert 'id=\"btn-pdf\"' not in Path('popup/popup.html').read_text()
assert 'ttsOpenAI' in Path('popup/popup.js').read_text()
assert 'playAudioOffscreen' in Path('options/options.js').read_text()
PY
```

额外残留扫描确认：

- 正式文档中已无旧的 Popup PDF 入口描述
- 正式文档中已无 Fish Audio 的保留能力描述
- 离线翻译相关文案已统一到“仅英译中”

## 未做项

- 没有用真实 OpenAI / Google / GLM Key 在浏览器里手工验证 Popup 朗读和测试播放
- 没有实现真正的 PDF 功能，只是移除了误导性入口
