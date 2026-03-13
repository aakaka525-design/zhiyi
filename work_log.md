# 工作日志

## 2026-03-12 探索谷歌API服务

**目标**: 列出所有可用的谷歌API，创建分类文档以便项目接入。

**操作**:
1. 确认 gcloud 配置：账户 `juniya1314@gmail.com`，项目 `manga-translator-2602111442`
2. 使用 `gcloud services list --available` 获取全部可用 API
3. 过滤出 515 个谷歌官方 API（`googleapis.com`）
4. 确认当前已启用 33 个 API
5. 创建分类文档 `docs/google-apis-catalog.md`，按以下类别整理：
   - AI/机器学习（22个）
   - 地图/位置服务（25个）
   - Google Workspace/办公协作（18个）
   - Firebase（18个）
   - YouTube（5个）
   - 数据分析/BigQuery（13个）
   - 计算/基础设施（8个）
   - 存储/数据库（9个）
   - 安全/身份认证（12个）
   - 网络（7个）
   - 消息/事件（6个）
   - 移动开发/Play（5个）
   - 广告/营销（7个）
   - 搜索/内容（8个）
   - 行业特定（9个）
   - 监控/运维（6个）
   - 开发工具/CI/CD（9个）

**产出**: [docs/google-apis-catalog.md](docs/google-apis-catalog.md)
