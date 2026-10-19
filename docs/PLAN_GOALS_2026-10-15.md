# 目标规划（2026-10-15，指挥拟；用户要求按目标推进、每批任务包更大）

基线：main = multiplayer `6b362a5`（#91）。八人联机首版已合 main，真机一局反馈已处理（P1–P5）。本文件按**目标**而不是按零散 bug 排工，每批派 3–4 个并行窗口，每个窗口是一个可独立合并的端到端包（规则+测试+文档，或 服务器+界面+e2e）。进度与验货记录仍写 `docs/DISPATCH_2026-10-14.md`，本文件只改目标状态。

## 现状盘点（决定目标优先级的事实）

盘点日期 2026-10-19，基线 `multiplayer` @ `bc49cac`（v12）。数字按代码运行时导出实际数出（用 esbuild 打包 `src/simulation/content/index.ts` 等导出后计数），不取自交接文档。**每次收工都要按同样口径重数并更新本表。** 2026-10-15 的旧值（英雄 19、羁绊 5、强化 6、异变 3）已作废。

| 维度 | 现状（multiplayer v12） | 14.24b 全量 | 差距 | 计数来源 |
| --- | --- | --- | --- | --- |
| 英雄 | 60（1 费 14 / 2 费 13 / 3 费 13 / 4 费 12 / 5 费 8），商店卡池同为 60 | 60 | 已齐 | `M5_UNIT_DEFINITIONS`（`src/simulation/units.ts`）；`SHOP_CATALOG_BY_COST`（`src/simulation/match-rules.ts`）；全量取 `raw/en_us.json.gz` 中 `TFTSet13` 可上场英雄 |
| 召唤/中立单位 | 中立 5、虚空生物 1 | — | — | `NEUTRAL_UNIT_DEFINITIONS`（`units.ts`）；`G24_VOIDSPAWN_UNITS`（`content/g2-4b-voidspawn.ts`） |
| 羁绊 | 25 | 33（含 7 个双人关系羁绊与百变） | 8：百变（Form Swapper）+ 7 个双人关系羁绊，均在规则清单 `blocked` 中 | `TRAIT_DEFINITIONS`（`content/traits.ts`）；全量取 `raw/en_us.json.gz` `TFTSet13.traits`；缺口见 `content/rules-manifest.ts` 的 `form-swapper-trait`、`seven-teamups` |
| 普通装备 | 8 组件 / 36 成装 / 36 光明 | 8 / 36 / 36 | 已齐 | `ITEM_DEFINITIONS`（`content/g2-3-item-registry.ts`）按 `kind` 分组；成装取非 `TFT` 前缀的 `completed` |
| 神器 | 29 | 29（`ORNNARTIFACTS_SET6`） | 已齐 | `G24_ARTIFACT_SOURCE`（`content/g2-4-artifact-source.ts`），与 `ITEM_DEFINITIONS` 交集 29 |
| 辅助装 | 17 | 17（`SUPPORTITEMS`） | 已齐 | `G24_SUPPORT_ITEM_SOURCE`（`content/g2-4-support-item-source.ts`），与 `ITEM_DEFINITIONS` 交集 17 |
| 炼金男爵专属装 | 28 | 28（`raw` 中 32 个 `TFT13_Crime_*` 对象，另 3 个是消耗品、1 个是金币对象） | 已齐 | `ITEM_DEFINITIONS` 中带 `restriction: chem-baron` 的条目 |
| 其他特殊装 | 1（战术家之冠 `TFT_Item_ForceOfNature`） | — | — | `ITEM_DEFINITIONS` 中不属于上述各类的 `completed` |
| 消耗品/锻造器 | 3 个消耗品（磁力移除器、组件重铸器、成装重铸器）；锻造器 3 个池（成装/辅助/神器，四选一）；复制器 2 种（次级英雄、次级微光） | — | 大英雄/大微光复制器不做（用户已定） | `CONSUMABLE_DEFINITIONS`（`content/consumables.ts`）；`G24_FORGE_POOLS`（`content/g2-4-forges.ts`）；`content/g2-3-policy.ts` 复制器表 |
| 征服者档位 | 15/15 档全部接入，无延后档 | 15 | 已齐 | `G23_CONQUEROR_CHESTS`（`content/g2-3-policy.ts`，`length:15`，`G23_DEFERRED_CONQUEROR_ITEMS` 为空） |
| 强化 | 30（银 14 / 金 13 / 彩 3） | 310 个标准池候选（银 68 / 金 148 / 彩 94）；本阶段目标 60 | 目标差 30；全量差 280 | `AUGMENT_DEFINITIONS`（`content/augments.ts`），等级取 `AUGMENT_TIERS`（`content/augment-policy.ts`）；全量见 `planning/s13-14.24-multiplayer-audit.html`（2026-10-18 审计） |
| 异常 | 30 | 57（`TFTSet13_Evolved` 池 61 项中非零权重 57） | 27 | `ANOMALY_DEFINITIONS`（`content/anomalies.ts`）；全量同上审计 |
| 流程 | 开场、1-1 与 2-4/3-4/4-4/5-4/6-4 选秀、PvE、PvP、配对预告、强化选择、补给、加时、淘汰、排名 | 同左 | 流程已对齐 | `src/simulation/carousel-policy.ts`、`carousel.ts`（含 `'1-1'`）；`src/server/room/pairing.ts`（G1-P6 配对预告） |
| 运维 | 单局服务器；`/healthz`；`deploy/deploy.sh` + `deploy/cat-game.service`（systemd） | — | 上线清单见 `planning/release-v12-checklist.md` | `src/server/net/server.ts`、`deploy/` |
| 测试 | 317 个 `*.test.ts`；`fast` 与 `timing`（串行，7 个文件）两个 vitest project | — | 计时类断言不挡合并，改每夜报告 | `find tests -name "*.test.ts"`；`vitest.config.ts` |

**集成分支，待 v13 收口（不计入上表）：** `integration/s13-augments` @ `05c6792` 已合 P2（#188）、P3（#189）、P4（#192），P1（#191）仍开着未合。运行时导出为强化 51（银 14 / 金 26 / 彩 11，即 +21）、异常 51（+21）；英雄、羁绊、装备数与 multiplayer 相同。计数口径同上，在该分支上导出 `AUGMENT_DEFINITIONS`、`ANOMALY_DEFINITIONS`。

原始数据：`src/simulation/content/source/s13-14.24b/raw/en_us.json.gz`（CDragon 14.24b 全量，12 MB，SHA 已锁），`scripts/import-m8-source.py` 已能按 hash 校验抽取；图标走 `scripts/fetch-s13-assets.cjs`（communitydragon）。扩内容不缺数据，缺的是实现与测试。

## 目标

| 目标 | 内容 | 完成判定 | 归属 |
| --- | --- | --- | --- |
| **G1 对局流程补齐** | P6 配对预告（候选对手→开战确定）；P7 选秀（1-1 与 x-4 共享选秀、开局金币/组件按 14.24b）；观战/侦察（准备期点右侧玩家看其公开棋盘） | 八人一局从 1-1 到终局每个阶段与 14.24b 流程一一对应，e2e 覆盖 | 服务器+界面 Opus；规则/合同 Codex |
| **G2 内容扩容** | 英雄→60、羁绊→28、装备→9 组件 36 成装、强化→60、异变→60；按批次发布，每批一次 digest | 每批：来源 hash 可追溯、技能数值与 14.24b 对账表、战斗 oracle/golden、图标清单；用户真机可见 | Codex（规则/内容/测试）；Opus（图标清单接入、羁绊面板、技能说明展示） |
| **G3 运维与稳定** | 一键部署脚本（systemd/pm2 二选一）、`/healthz`、结构化日志、房间异常收局回队列、版本/digest 在页面可见；P8 e2e 竞态 | 用户照文档 10 分钟内重部署；异常一局不需要重启进程 | Opus（`src/server/`）；Codex（发布说明） |
| **G4 测试提速** | 耗时断言（b8 启动、m5-replay cannon、C19 整局）移入独立串行 project；全套 ≤ 8 分钟；flake 清单归零 | 合并树一次全套不需人工复跑 | Codex（`tests/`、vitest 配置、`.github/`） |
| **G5 界面完善** | 战后伤害/承伤统计、战斗回放回看、对手阵容侦察、金币/利息提示、连胜连败显示（部分已有） | 用户真机不再问"这局发生了什么" | Opus；数据缺口走 UI_REQUESTS 由 Codex 补 |

推荐顺序：**G2 与 G1/G3 并行**（Codex 两窗口吃 G2+G4，Opus 两窗口吃 G1+G3），G5 穿插在 Opus 窗口空闲时。G2 分 4 批：
- G2-1：补齐现有 5 职业的全部英雄 + 新增 3 个阵营羁绊（#94：+14 英雄 Automata/Firelight/Family，33 英雄 / 8 羁绊；斯维因形态证据不足推迟到 G2-2）。
- G2-2：再 +15 英雄 +6 羁绊 +10 成装，强化补到 30。
- G2-3：剩余英雄与羁绊，成装补齐 36，异变补到 30。
- G2-4：强化到 60、异变到 60、光明装备（可选）。
每批 Codex 先在 PR 内给对账表（英雄/技能/羁绊数值 vs CDragon 字段），指挥只抽查 5 个英雄 + 全部羁绊断点。

## 用户待拍板

1. G1-P7 选秀是否做（此前默认不做）。建议：做 1-1 与 x-4 选秀，这是真机体感差异最大的流程项。
2. G2 新英雄图标：`public/assets/` 归 Claude，但抓取脚本归 Codex。建议：允许 Codex 在 G2 各批 PR 内直接运行 `fetch-s13-assets.cjs` 提交新增图标与来源清单（机械操作，不改布局），指挥验货核对 hash 清单。
3. G3 部署形态：systemd（建议，服务器已有 Node 22）或 pm2。

## 状态

- 2026-10-15：第七批按本规划扩为四窗口（见 DISPATCH 第七批）：Opus W1 = G1-P6 + 侦察 + P8；Opus W2 = G3 运维包；Codex W3 = G2-1 内容扩容第一批 + §10 配对规则；Codex W4 = G4 测试提速 + SR-B8-03。
- 2026-10-15 上午：G1-P6、侦察、P8、G3 已合 multiplayer `a159fbb`（#92/#93/#95）。G2-1 #94 因全套 30 文件失败打回转正中。G4 未开工重发。指挥代决：P7 做、Codex 可提交图标、systemd。第八批见 DISPATCH。
- 2026-10-15 深夜：#109 G5 接线、#110 P7 选秀接线、#108 SR-G2-01 合入 multiplayer `291e7c8`；G1 流程目标达成（P6 配对预告、P7 选秀、侦察全部可玩）；G5 数据接入完成；G2-2 英雄扩容与强化仍在做。
- 2026-10-15 晚：P7 #100 与 G5 数据侧 #106 合入 multiplayer `f7e565b`，CONTENT `1ce135cf`；G1 只剩 Opus 选秀接线；G5 数据缺口已补齐待 Opus 接入；下一批 G2-2 + 强化。
- 2026-10-15 傍晚：G2-1 #94 合入 multiplayer `30433fb`（33 英雄 / 8 羁绊，CONTENT `70a355f3`）；G4 #98/#104/#105 全部合入，G4 关闭；G5 数据侧 #106 草稿中；P7 #100 待 rebase。
- 2026-10-15 下午：G5 本场/累计统计与经济提示合入（#97）；G4 fast/timing 拆分合入（#98，fast 482 s / timing ≤169 s），G4-2 只剩 b8 startup 断言改中位数。G1-P7 合同合入（#99），规则实现与接线进行中；G2-1 转正进行中。
