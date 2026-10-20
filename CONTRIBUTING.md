# 参与开发

欢迎提 issue 和 PR。下面是这个仓库的工作方式，动手前请先看一遍。

## 分支

| 分支 | 用途 |
| --- | --- |
| `multiplayer` | 日常开发主线。**新 PR 请以它为目标分支** |
| `release/vN` | 上线候选，从 `multiplayer` 切出，验收后合入 `main` |
| `main` | 线上版本，只从 `release/vN` 合入，自动部署到 GitHub Pages |
| `3d` | 3D 模式的集成分支，各 3D 任务 PR 进这里 |

一个任务一个分支、一个 PR。合并方式是 merge commit，不压缩、不改写别人分支的历史。

## 提交前

```sh
npm ci
npm run typecheck
npm test -- <你改到的测试文件>
npm run build
```

按改动影响面选测试即可，完整浏览器验收交给 CI。CI 会根据改动自动分档（只改文档 / 改界面 / 改规则），`ci-required` 通过才能合并。不要为了变绿而跳过、禁用或删除测试；测试只因计时超时（断言都过）时，放宽时限要在注释里写明原因。

## 规则代码的约定

`src/simulation/` 是整局唯一的规则权威，改它之前先读 [Match 契约](docs/MATCH_CONTRACT.md)、[Combat 契约](docs/COMBAT_CONTRACT.md) 和 [M5_RULES.md](M5_RULES.md)。

- 不依赖 Phaser、DOM、网络或真实时钟；不用 `Math.random()` 或 `Date.now()`，随机只用显式的 `lcg32-v1` 随机数生成器。
- 命令失败返回原状态和失败原因，不产生事件、不消耗资源或随机数。
- 数值一律为整数，百分比用基点；战斗固定 50 ms 一个 tick。不为显示方便改运算顺序。
- 奖励、收入、成长按唯一收据只发一次；重复执行、继续或恢复都不能重发。
- 改规则或数值要有独立的数据依据（14.24b 公告、数据挖掘），并同步修改契约文档、版本号和内容 digest。不能只重录 golden 让测试变绿。
- 版本锁在 14.24b：不引入后续补丁的改动。

界面（`src/rendering/` 等）和服务器（`src/server/`）只发命令、读状态，不另算金币、伤害或胜负。需要新数据时，在 [docs/UI_REQUESTS.md](docs/UI_REQUESTS.md) 写明字段、含义、用途和验收条件，由规则侧实现。

## 素材

- **不要提交任何 3D 模型、贴图、动作、特效、音效或字体文件**，也不要提交 Riot 的原画。3D 素材只放本机的 `assets3d-local/`。提交前用 `git status` 确认。
- 2D 图标通过 `scripts/fetch-s13-assets.cjs` 从 CommunityDragon 获取；图片路径用 `import.meta.env.BASE_URL` 拼接，不要写死 `/assets/...`。
- `artifacts/`、`dist/`、`dist-server/` 是生成物，不提交。
- 文档、日志里不要写本机绝对路径、主机名、令牌或个人信息。

## 关于 AGENTS.md

这个项目目前主要由两个 AI 编程助手按 [AGENTS.md](AGENTS.md) 分工维护：Codex 负责规则、测试、脚本和文档，Claude 负责界面、联机服务器和表现层。外部贡献者不受这份分工约束，但上面的不变量对所有人都适用；PR 评审会问三个问题：测试过了吗、越过目录边界了吗、改了玩法吗。

## 许可证

仓库暂未选定许可证（见 [README](README.md#许可证)）。在 `LICENSE` 加入之前，较大的改动请先开 issue 讨论。Riot 的素材和数据不受任何代码许可证覆盖，见 [NOTICE.md](NOTICE.md)。
