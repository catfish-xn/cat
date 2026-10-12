# T1 派工单：规则引擎的生产 Node 入口

日期：2026-10-12
派给：Codex（GPT）
派单人：用户，经 Claude 整理
依据：`docs/MULTIPLAYER_RENOVATION_V2.md` 第 7 节 N1 与第 10 节、`docs/MULTIPLAYER_N0_BASELINE.md` 第 5 节
分工：`AGENTS.md`「八人联机分工」一节（方案 A 已采纳）

## 0 先读这一段：分工和产品决定有变化

用户已采纳方案 A，和你在 N0 中建议的分工不同，请以 `AGENTS.md` 为准：

- 你负责流水线 A：T1 → T2 → T3 → TP → T7，以及 T9 的压测脚本和发布说明。文件范围不变：`src/simulation/`、`tests/`、`scripts/`、合同文档。
- Claude 负责流水线 B（T4 → T5 → T6，新建 `src/server/`）和流水线 C（界面，从现在起用假服务器先做）。你不修改 `src/server/`。
- 你每交付一个任务包，必须在合同文档里写清导出的函数签名、输入输出和失败原因枚举，Claude 只按合同调用。

用户新增三条产品决定，T1 不受影响，但请在 T2 之后、T4 开工之前把 `MULTIPLAYER_CONTRACT.md` 和 V2 中的对应条目改掉：

1. 不做房间系统：没有建房、邀请码、房主、准备键。准入由用户在网页入口另行控制，仓库不实现账号登录。玩家进入后只有一个「匹配」按钮。
2. 单一对局队列：服务器同一时间只跑一局。点匹配进入队列，任一玩家点开始或等待超时即开局，不足八人由机器人补满。队列已满 8 人时第 9 人报错，不排队、不开第二局。
3. 座位凭证仍由服务器生成，用于重连和防冒充，玩家不可见、不需要输入。

## 1 任务目标

把现在只能在浏览器里跑的规则引擎（`src/simulation/`）做成一个普通 Node 能直接启动的生产构建，并证明在固定输入下结果和浏览器版完全一致。这是后面所有服务器工作的地基。

一句话判据：**不开 Vite、不开浏览器，`node dist-server/xxx.mjs` 能跑完一场已知战斗，state、events、RNG 和基线逐字节一致。**

## 2 起点

| 项目 | 值 |
| --- | --- |
| 施工起点 | `docs/server-authority-audit` 分支，提交 `4d51ec95c0aafad5bf3e9974f9b828cc1a847b69` |
| 开发分支 | `codex/t1-node-entry`，从上述提交开出 |
| 合入目标 | 集成分支 `multiplayer`（若尚未存在，从同一提交创建后再合） |
| 不要动 | `main`、`src/rendering/`、`src/presentation/`、`src/main.ts`、`index.html` |
| 已有参考 | `scripts/verify-server-engine-portability.cjs`（探针，esbuild 打包后子进程运行）；`docs/SERVER_AUTHORITY_ARCHITECTURE_AUDIT.md` 第 3 节 |

探针已经证明"能打包、能跑一场"，但它是临时脚本，把源码字符串写在 `.cjs` 里，产物落在 `artifacts/`。T1 要把它变成正式、可维护的构建入口。

## 3 实施范围

1. **安装与记录。** 按锁文件 `npm ci`，记录实际 Node 和 npm 版本。先原样运行探针脚本，保存本机基线结果（tick 数、事件数、胜负）。
2. **正式入口文件。** 新建 `src/server-entry/` 或同等位置的 TypeScript 入口（名字你定，写进合同），只导出服务器需要的纯规则 API：`createMatch`、各命令函数、`stepMatch`、`startMatchCombat`、`serializeMatch`/`restoreMatch`，以及后续 T2 要用的快照类型。不导出 rendering、presentation、persistence 的浏览器实现。
3. **正式构建命令。** 在 `package.json` 增加 `build:server`（建议 esbuild，已在探针中用过；若需要新增 devDependency 请写明理由）。要处理：TS 省略扩展名的导入、JSON 导入、`structuredClone`/`BigInt` 等运行时要求。产物放 `dist-server/`，加入 `.gitignore`。
4. **可注入边界。** 入口不得读真实时钟或 `Math.random()`。时钟、随机种子、计算步数上限全部由调用方传入。这一条是给 Claude 的 `src/server/` 留的接口，请在合同里写明参数名和类型。
5. **一致性验证脚本。** 新增 `scripts/verify-t1-node-entry.cjs`（或 `.mjs`），`npm run test:server-entry` 调用，做四件事：
   - 用 seed 42 跑完首场战斗，与探针基线比对 state、events、RNG 状态。
   - 发一个旧 `shop.generation` 的购买命令，断言返回原 state、无事件、RNG 不变。
   - 在 tick 40 序列化再恢复，继续跑到结束，与不中断的结果 deepEqual。
   - 检查构建产物的输入文件清单，断言没有 `src/rendering/`、`src/presentation/`、`phaser` 进入闭包。
6. **测试命名。** 新测试文件以 `t1-` 开头，与既有 M5–M8 测试分开；不改既有测试。
7. **合同更新。** 在 `docs/MULTIPLAYER_CONTRACT.md` 新增「服务器规则入口」一节：导出清单、构建命令、运行方式、注入参数、失败原因枚举。

## 4 验收标准

- [ ] `npm run build:server` 成功；`node dist-server/<入口>.mjs` 在无 Vite、无浏览器全局变量的环境跑完 seed 42 首场战斗。
- [ ] 固定输入下 state、events、RNG 与探针基线一致（给出比对方式，不只写"通过"）。
- [ ] 旧 generation 购买、金币不足等失败命令不改 state、不产事件、不消耗 RNG。
- [ ] 构建闭包清单中没有 rendering、presentation、Phaser。
- [ ] 只有一份 `src/simulation/`，没有复制后分叉，没有删客户端目录。
- [ ] `npm run typecheck`、`npm test`、`npm run test:server-entry` 通过；既有已知失败单独列出，不混入。
- [ ] 合同文档有「服务器规则入口」一节，Claude 能只看它就调用。
- [ ] 没有顺手做联网、卡池、机器人或任何规则改动。

## 5 禁止事项

- 不批量重写 `src/simulation/` 的 import 来迁就 Node；构建边界有问题改构建配置。
- 不为让 Node 启动而删掉 digest、版本或恢复校验。
- 不合并 main，不部署，不改正式站点。
- 不启动 T2 的双方战斗改动；T1 只做入口。

## 6 交付格式

按 `AGENTS.md` 的汇报格式。另附：

- 实际 Node/npm 版本、提交哈希。
- `build:server` 和 `test:server-entry` 的真实命令输出摘要。
- 合同新增章节的链接。
- T2 的最小实施范围建议（一段话即可）。

交付后由 Claude 做交叉验货：拉分支、跑三条命令、对照合同检查导出是否齐全。通过即合入 `multiplayer`，不需要再向用户索取确认。
