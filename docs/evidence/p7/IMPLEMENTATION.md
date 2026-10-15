# P7 共享选秀实现与发布验收

本分支从 multiplayer@3c192bb 继续，合同 #99 已由指挥合入 b484a28。规则采用用户方案 B：含 1-1，HP 升序、平血 seatIndex 升序，每批两人；时间参数 6000/6000/6000 ms，固定截止、绝不提前关闭，到期未选者规则自动选取。历史来源 H/I/U 和项目政策 P 见 S13_RULES_GAP §11，不将项目选秀概率与 1-1 前奏冒称 14.24b 已证实历史。

## 接线与改动范围

- server-entry 导出建盘、参与席冻结、原子选取/自动选取、分批时间、公共槽投影、关闭经济、排队单位、淘汰释放、可信快照一致性校验；白名单同步。
- 盘预留、唯一 receipt 与 shared-pool-v3 组成一笔事务；失败返回原对象、零事件与零 RNG 消费。满备战席保存池内已拥有的排队单位，不自动出售。
- 1-1 为 1-2 前奏，不增加 catalog 行；新入口空玩家阵容、0 金币/组件，无免费 Irelia。x-4 不再发旧组件选择，自然经济只在选秀固定截止后结算一次。
- SR-G1-02 每个端口与待明确项均在 MULTIPLAYER_CONTRACT §21.4–21.5 / MATCH_CONTRACT P7 / UI_REQUESTS 回答。房间/网络与界面由 G1 接线，本实现未修改 src/server 或界面。
- restoreCarouselSeat 检查可信服务器快照的 P7 池/收据/资产一致性；并非面向客户端上传的完整 Match 认证入口。其余房间恢复仍沿原服务器边界。

## 一次发布身份与历史夹具

CONTENT_DIGEST 仅一次从 `fnv1a32-utf16:77f80fec` 改为 `fnv1a32-utf16:f95bdcf8`，manifest 加入 carousel-v1/shared-pool-v3。LOOT_REPLAY_DIGEST 保持 `fnv1a32-utf16:b8d9d7ca`；schema7/save3/replay3/command3 保持。旧 digest 拒绝续玩，不迁移、不补发。

`node scripts/record-p7-release.cjs` 实际运行四条公共离线路线并重录 P7 独立夹具：cannon/sniper 各 67 个完整状态与 P3 原录制逐字段比较，唯一差异为显式 contentDigest 替换；四条路线每轮事件 hash 与每条命令完全相同，events/RNG trace 保持原值。134 个新录制状态逐个 serialize/restore 全等；C19 输入重新 compileBattle，除身份外与历史输入完全相同。证据见 release-audit.json 与 p7-content-baseline.json。

Herald 五条 raw 通过原公共命令生成器从真实对局导出，在加载 restore 之前写出原始状态，然后验证生产恢复和开战/15 tick 往返。使用新的 p7-herald-raw 目录，manifest 记录最终源码 hash。T13/P3 与更早 golden/录制原件保持原字节；消费者改用新 P7 夹具，未删除或放宽任何断言/时间预算。

## 作者验收

Node v22，单 worker。详细最终全套结果在本节验收完成后填入，不以局部绿代替全套清零。

- `npm run typecheck`：通过。
- `npm run test:server-entry`：通过；165 个状态、106 个事件的旧入口对照保留。
- P7 + 共享池/奖励/来源账本：4 文件 / 103 用例通过，11.76 s。
- P7 + P7/T13 身份 + C19：4 文件 / 30 用例通过，10.10 s（与上项有重叠，不相加冒称总数）。
- 全套 `npm test -- --maxWorkers=1`：运行中。

G4 #98 的 fast/timing 性能收尾按用户要求在 P7 合入后继续；本分支未混入 G4 性能改动。
