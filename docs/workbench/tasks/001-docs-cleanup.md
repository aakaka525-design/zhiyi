---
status: done
priority: P1
created: 2026-03-08
---

# 001 — 全面整理 docs 目录

## 背景

docs 目录在短时间内快速创建，存在信息不准确、内容重复、结构不合理、遗漏等问题。需要一次性全面整理。

## 当前结构

```
docs/
├── contributing/
│   └── development.md       # 开发指南
├── guide/
│   ├── api-configuration.md # API 配置指南
│   ├── getting-started.md   # 安装与快速上手
│   └── native-host-setup.md # 已移除功能说明
├── reference/
│   ├── architecture.md      # 架构设计
│   ├── features.md          # 功能说明
│   └── project-structure.md # 项目结构
├── README.md                # 文档索引
└── workbench/
    ├── README.md
    ├── CONVENTIONS.md
    ├── tasks/
    ├── reports/
    └── discussions/
        └── README.md
```

## 目标结构

```
docs/
├── README.md                # docs 目录索引（新增）
├── guide/                   # 用户/开发者指南
│   ├── getting-started.md   # 安装与快速上手（合并自 README.md 相关段落）
│   ├── api-configuration.md # API 配置（修正后）
│   └── native-host-setup.md # 已移除功能的历史说明（如保留）
├── reference/               # 技术参考
│   ├── architecture.md      # 架构设计（修正后）
│   ├── project-structure.md # 项目结构（更新后）
│   └── features.md          # 功能说明（补全后）
├── contributing/            # 开发者贡献
│   └── development.md       # 开发指南（去重后）
└── workbench/               # 协作工作台（保留）
    ├── README.md
    ├── CONVENTIONS.md        # 去重后，引用 contributing/development.md
    ├── tasks/
    ├── reports/
    └── discussions/
        └── README.md         # 讨论区补充说明（与 workbench/README.md 保持一致）
```

**变更说明**：
- `audit/` 已移入 `workbench/tasks/003-full-audit.md`（已完成）
- 按受众分三个子目录：`guide/`（使用者）、`reference/`（查阅）、`contributing/`（开发者）
- 新增 `docs/README.md` 作为文档索引
- OCR / 图片识别 / Native Host 已在 `002-remove-ocr` 中移除，相关文档若保留，应转为历史说明而非安装指南

**2026-03-09 基线说明**：
- 本任务已完成；以下勾选状态按最终仓库状态回填
- 目录重组、索引补齐、链接迁移和基础验证均已完成
- 历史旧路径仅保留在本任务的迁移命令示例中，不构成实际文档链接

---

## 任务清单

### 第一步：修正内容错误（最高优先级）

#### 1.1 修正 `api-configuration.md`

- [x] **DeepSeek Base URL**: 已按代码修正为 `https://api.ppinfra.com/openai`
- [x] **DeepSeek Model**: 已按代码修正为 `deepseek/deepseek-ocr`
- [x] **QwenVL 配置**: 已随 `002-remove-ocr` 移除，不再需要配置说明
- [x] **Gemini Model**: 已补充默认模型 `gemini-2.5-flash`

#### 1.2 修正 `architecture.md`

- [x] Action 表已补充 `ttsGLM`（GLM TTS）和 `testTTS`（TTS 测试）
- [x] 过时的设置字段数量表述已移除

#### 1.3 补全 `features.md`

- [x] **PDF 翻译（第5节）**: 已补充触发方式与基础说明
- [x] **TTS 引擎**: 已补充 GLM TTS（`ttsGLM`）

#### 1.4 更新 `project-structure.md`

- [x] 目录树已补充 `docs/workbench/` 及其子目录
- [x] 目录树已补充 `.gitignore`
- [x] 按最终目录结构更新整个 `docs/` 部分的树

#### 1.5 更新 `workbench/tasks/003-full-audit.md`（原 `audit/AUDIT_PLAN.md`，已迁移）

- [x] 第 9.1 节：移除 "建议添加 `.gitignore`" 和 "建议添加 `README.md`"（已完成）
- [x] 第 9.4 节：标记已完成的文档项（README、开发者文档、API 配置指南、native-host 指南）
- [x] 第 1.4 节：权限列表补充 `declarativeNetRequestWithHostAccess`

---

### 第二步：消除重复

#### 2.1 `CONVENTIONS.md` 与 `development.md` 去重

- [x] `CONVENTIONS.md` 中的代码风格部分（缩进、命名、命名空间、消息格式）改为引用 `development.md`：
  ```markdown
  ## 代码风格
  详见 [开发指南](../contributing/development.md#代码风格)
  ```
- [x] `CONVENTIONS.md` 仅保留 Agent 专属内容：执行原则、不要做的事、关键路径速查表

#### 2.2 对齐 `discussions/README.md` 与 `workbench/README.md`

- [x] `discussions/README.md` 已保持为目录补充说明，只保留讨论区特有规则
- [x] 通用的书写格式规范已收敛到 `workbench/README.md`

#### 2.3 `features.md` 与 `architecture.md` 去重

- [x] `features.md` 每个功能的 "相关模块" 部分简化为一行链接到 `architecture.md`，不再重复列出完整模块清单

---

### 第三步：目录重组

#### 3.1 创建新目录

```bash
mkdir -p docs/guide docs/reference docs/contributing
```

- [x] 已创建 `docs/guide`、`docs/reference`、`docs/contributing`

#### 3.2 移动文件

```bash
# 指南类
mv docs/api-configuration.md docs/guide/
mv docs/native-host-setup.md docs/guide/

# 参考类
mv docs/architecture.md docs/reference/
mv docs/project-structure.md docs/reference/
mv docs/features.md docs/reference/

# 贡献类
mv docs/development.md docs/contributing/
```

- [x] 已按目标结构完成文件移动

#### ~~3.3 移动审核计划到 workbench~~ （已完成，迁移为 `tasks/003-full-audit.md`）

#### 3.4 创建 `docs/README.md` 索引

```markdown
# 文档索引

## 使用指南
- [快速上手](guide/getting-started.md)
- [API 配置](guide/api-configuration.md)
- [Native Host（已移除）](guide/native-host-setup.md)

## 技术参考
- [架构设计](reference/architecture.md)
- [项目结构](reference/project-structure.md)
- [功能说明](reference/features.md)

## 开发贡献
- [开发指南](contributing/development.md)

## 协作工作台
- [Workbench](workbench/README.md)
```

- [x] 已创建 `docs/README.md`

#### 3.5 创建 `docs/guide/getting-started.md`

从根 `README.md` 提取安装步骤、API 配置和主要功能入口，展开为完整的入门指南。根 `README.md` 保持精简，改为链接到此文件。

- [x] 已创建 `docs/guide/getting-started.md`

---

### 第四步：更新所有内部链接

- [x] 根 `README.md` 文档索引表中的链接全部更新为新路径
- [x] `CONVENTIONS.md` 关键路径表中的 `docs/` 引用更新
- [x] `workbench/README.md` 中的目录树更新
- [x] 确认 `discussions/README.md` 与 `workbench/README.md` 的规则描述一致
- [x] 全文搜索 `docs/` 开头的链接，确保无死链

---

### 第五步：验证

- [x] 检查所有 `.md` 文件内的链接是否可达
- [x] 确认无空目录
- [x] 确认 `docs/audit/` 已删除
- [x] 通读正式文档，确认无残留的旧路径引用（仅 `001` 内的历史迁移命令示例保留旧路径）

---

## 注意事项

1. 移动文件时保留 git 历史（用 `git mv`）
2. 不改动 `workbench/` 内部结构（已确定）
3. 当前任务文件 `001-docs-cleanup.md` 本身路径不变
4. 修正内容时以源代码为准，不要猜测
