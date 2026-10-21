# HEX 自动战棋

浏览器里玩的六角棋盘自动战棋，复刻《云顶之弈》S13（双城之战 II）**14.24b** 版本的规则与内容。以**八人联机**为主：一台服务器同时跑一局，真人点“匹配”进入队列，不足八人由机器人补位；也保留了单人模式。只面向桌面 Chromium。

这是免费、非商业的粉丝项目，与 Riot Games 无关。代码以 [MIT](LICENSE) 发布，Riot 的素材和数据除外，见下方「免责声明」和 [NOTICE.md](NOTICE.md)。

- 在线试玩（GitHub Pages，跟随 `main`）：<https://catfish-xn.github.io/cat/>
  公开站点没有联机服务器，只能玩单机；正式构建不带浏览器内房间，打开 `?mode=online` 只会提示去测试服。

## 现在做到哪了

| 方面 | 状态 |
| --- | --- |
| 版本锁 | 规则、数值、图标都固定在 14.24b，不跟进后续补丁。原数据查不到的地方定约定值，并在契约文档里注明 |
| 内容 | S13 全部 60 名可购买英雄与羁绊、装备（含神器、辅助装、光明装等）、强化、异常、选秀、野怪与法球掉落 |
| 联机 | 单局 WebSocket 服务器：匹配队列、机器人补位、共享有限卡池、服务器权威结算、断线重连；不做房间、邀请码和账号 |
| 单人 | 原有单人流程、存档导入导出、回放与统计仍可用 |
| 3D | 实验中的单独加载模式（集成分支 `3d`）。模型和贴图只放在开发者本机，**不进仓库**，公开站只画占位棋盘 |

发布节奏：日常开发在 `multiplayer` 分支，上线时切 `release/vN` 合入 `main`，`main` 自动部署到 Pages。

## 本地运行

需要 Node.js 22.12 或更高版本。

```sh
npm ci
npm run dev          # 开发服务器，默认 http://localhost:5173/
```

打开页面后：

| 地址 | 玩法 |
| --- | --- |
| `/` | 单人模式 |
| `/?mode=online` | 联机界面，房间在浏览器里运行（不需要服务器）；只有 `npm run dev` 和 `VITE_LOCAL_ROOM=1` 构建带它，正式构建只显示提示 |
| `/?mode=online&server=ws` | 联机界面，连接真正的游戏服务器 |

连本机服务器时，用一条命令同时启动服务器（端口 8787）和开发服务器，开发服务器会把 `/ws` 转发给游戏服务器：

```sh
npm run dev:online
# 然后打开 http://localhost:5173/?mode=online&server=ws ，多开几个标签页就是多个真人席
```

只启动服务器用 `npm run serve:game`。服务器的环境变量（准备时长、队列超时、掉线接管等）和正式部署步骤见 [联机发布说明](docs/MULTIPLAYER_RELEASE_NOTES.md)。

### 3D 模式（实验）

3D 代码合入后，用 `?render=3d` 打开。素材根地址由 `?assets3d=<url>` 或构建变量 `VITE_ASSETS3D_BASE` 指定，默认读本机的 `assets3d-local/`（已在 `.gitignore` 里）。仓库和 CI 只用可公开获取的占位素材或纯测试数据，**请不要把任何模型、贴图、动作、特效文件提交进来**。

## 测试

```sh
npm run typecheck
npm test                              # Vitest 快速档
npm test -- tests/m5-economy.test.ts  # 只跑一个文件
npm run build                         # typecheck + 生产构建
```

浏览器端到端验收（需要 `npx playwright install chromium`）耗时较长，命令和顺序见 [项目维护指南](docs/PROJECT_GUIDE.md)。CI（`.github/workflows/ci.yml`）按改动范围分档：只改文档约半分钟，改界面约十分钟，改规则跑全套。`ci-required` 是合并前唯一必需的检查。

## 代码结构

| 目录 | 内容 |
| --- | --- |
| `src/simulation/` | 纯 TypeScript 领域规则：整局状态机（`match.ts`）、战斗、经济、联机账本；`content/` 是固定的 14.24b 内容 |
| `src/server/` | 联机服务器：匹配队列、座位凭证、命令校验、视角投影、断线重连。只调用 simulation 的公开接口，不自己算规则 |
| `src/rendering/` | Phaser 场景、输入和 DOM 面板；`online/` 是联机客户端 |
| `src/presentation/`、`src/persistence/`、`src/replay/`、`src/stats/`、`src/m6/` | 表现映射、存档、回放、统计、应用集成 |
| `tests/` | 回归测试；`tests/fixtures/` 存放 oracle 与 golden |
| `scripts/`、`deploy/` | 验收与审计脚本；服务器部署脚本与 systemd 单元 |
| `docs/` | 规则与接口契约，导航见 [docs/README.md](docs/README.md) |

几条不能破坏的约定：

- 规则只在 `src/simulation/`。它不依赖 Phaser、DOM、网络或真实时钟，随机只用显式的 `lcg32-v1` 随机数生成器，同样的种子和操作必然得到同样的结果。
- 命令失败返回原状态和失败原因，不扣资源、不消耗随机数。数值全是整数，百分比用基点；战斗固定 50 ms 一个 tick。
- 界面和服务器只发命令、读状态，不另算金币、伤害或胜负。
- 奖励、收入按唯一收据只发一次，重复执行、断线恢复都不会重发。

## 文档

- 现行规则与接口：[Match](docs/MATCH_CONTRACT.md)、[Combat](docs/COMBAT_CONTRACT.md)、[联机合同](docs/MULTIPLAYER_CONTRACT.md)、[存档](docs/SAVE_CONTRACT.md)、[回放](docs/REPLAY_CONTRACT.md)、[经济规则](M5_RULES.md)
- 联机方案与部署：[改造方案 V2](docs/MULTIPLAYER_RENOVATION_V2.md)、[联机发布说明](docs/MULTIPLAYER_RELEASE_NOTES.md)
- 参与开发：[CONTRIBUTING.md](CONTRIBUTING.md)
- [docs/archive/](docs/archive/) 里的 M1–M6 旧计划、根目录的 `M6_GOAL.md`、`M7_PLAN.md`、`M8_PLAN.md` 和 `docs/` 下带阶段编号的文档是开发过程记录，按当时日期阅读，不代表现状。

## 许可证

本仓库的原创代码和文档以 [MIT 许可证](LICENSE) 发布。**Riot Games 的素材（`public/assets/s13/` 图标等）、游戏数据（`src/simulation/content/source/`）、名称和商标不在 MIT 许可范围内**，仍归 Riot Games 所有，详见 [NOTICE.md](NOTICE.md)。

## 免责声明

本项目是免费、非商业的 S13（14.24b）粉丝复刻，按 Riot Games 的同人作品政策（Legal Jibber Jabber）使用官方英雄头像与图标。界面模仿《云顶之弈》的布局和流程，不包含 Riot 的原画、字体或音效文件。

HEX is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
