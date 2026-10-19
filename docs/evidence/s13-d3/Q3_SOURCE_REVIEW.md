# D3 / PR #198：Q3 原版来源核对补记

## 核对范围与结论

2026-10-19，依据调度方转达的 dot/TASKS.md 14:20 +08 更新：Q3 改为先查原版来源，查不到才采用约定；Q6 只纳入有正式标准池证据的条目，Q7/Q8 本轮不做，不新增内容。本次仅补文档和 PR，不修改已经交付的实现、数值、测试、指纹或版本。

**结论：所查来源可确认“进入未知”描述具有暂离若干回合、归来获得属性的语义；不能确认满席归还、暂离可否出售/卸装/合星，以及轮选/加时是否计数的原版具体行为。** 未发现这些来源中有与现实现实质冲突的明确原文，但这不等于证明实现符合原版，也不宣称已穷尽所有原版来源。

因此，PR #198 中这些未知边界按新版 **Q3 兜底项目约定** 标记：到期满席继续托管同一实例直到有位置；暂离期间不可出售、卸装或合星；轮选与加时计回合。不得再将它们称作已考证的 14.24b 原版行为。后续若取得同版本可验证执行规则且有冲突，先提交原文/版本/影响供裁决，不自动修改规则。

## 已查来源和证据边界

### 1. 仓库归档 raw：版本路径为 s13-14.24b，上游档案为 14.24

在实现提交 `2989cc38353232d2f169ece6ee939b7839254c0c` 的原文件上只读 gzip 解压、JSON 检索、SHA-256 核验，未重新下载或写入归档。`provenance/manifest.json` 标明 `referencePatch=S13-14.24b`、`archivePatch=14.24`；档案不是完整可执行脚本，也不能自行证明所有 14.24b 边界。

|文件（均相对 src/simulation/content/source/s13-14.24b/raw/）|gzip SHA-256|本次检查|
|---|---|---|
|`map22.bin.json.gz`|`743bf3668141be28d44b39160dcfc0da0aca0e919e6aa14513a0b3feb666b2b0`|`/{711fd99c}`、`/{7f1fcc94}`、`/{560f71cc}` 及其引用|
|`zh_cn.tft.stringtable.json.gz`|`ae17b0ce7ebc199e3b3c8dbc7fc906cfb0a83a1c45a9d6ce2d4a78e1526ebca4`|`/entries/tft13_goopbuff_intotheunknown_title` 与 `_desc`|
|`en_us.tft.stringtable.json.gz`|`1a96281672670a865cea018b7b2c447ead04e74b7a6800984749cb0f71732e8e`|同名 title/desc 键，中英文描述相符|
|`en_us.json.gz`|`7e0e2d41a806833f6f18e5752c0d5eea4fa3a74e75b61c1c54853de74c2ac5d2`|递归查 IntoTheUnknown/进入未知，无命中；不从缺失记录推断行为或准入|

`map22 /{711fd99c}` 的 name 为 `TFT13_GoopBuff_IntoTheUnknown`。`effectAmounts` 给出 `NumRounds=3`、`GainedAP=50`、`GainedAD=0.5`。这些仅作为本次已查档案内容记录，D3 是可配置轮数的通用机制，没有据此新增异常或修改任何数值。

中文 `_desc` 原文：

> 该弈子消失@NumRounds@回合。当该弈子归来时，该弈子会获得@GainedAP@法术强度和@GainedAD*100@%攻击力。

英文 `_desc` 同样仅描述暂离时长及归来增益，没有规定交互禁用、满席或特殊回合计数。

`/{7f1fcc94}` 是 tooltip 的 TitleTra/DescriptionTra 映射。`/{560f71cc}` 的 name 为 `TFT13_GoopBuff_IntoTheUnknown_ReturnState`，类型是布尔单位属性定义，附带 `ReplicationRule=1`；**字段名本身不能证明归还执行规则**。`/{711fd99c}` 的五个不透明 hash 引用在本 map22 文件内无对应顶层记录；不得凭 hash 猜测卖出/卸装/合星拦截脚本或轮选计数。本次未取得可重演的原版执行脚本或同版本实机边界记录。

可复查的上游地址（本次使用本地归档，未用远端当前字节替换原件）：

- [CommunityDragon 14.24 map22](https://raw.communitydragon.org/14.24/game/data/maps/shipping/map22/map22.bin.json)
- [CommunityDragon 14.24 英文字符串](https://raw.communitydragon.org/14.24/game/en_us/data/menu/en_us/tft.stringtable.json)
- [CommunityDragon 14.24 中文字符串](https://raw.communitydragon.org/14.24/game/zh_cn/data/menu/en_us/tft.stringtable.json)
- [CommunityDragon 14.24 cdragon/tft/en_us.json](https://raw.communitydragon.org/14.24/cdragon/tft/en_us.json)

### 2. 已有文档与历史引用

- `6029d948f6bd191cb8b0853b6d24ac1462150c48:docs/S13_MECHANISM_INVENTORY.md`：D05/数值表与上述 raw 相符；表二 M07 是建议接口，不能当作原版执行证据。第 7 节“进入未知归来无位、暂离期间交互”明确将归来无位、出售/卸装/合星、轮选/加时计数列作需明确来源/用户决定的事项。
- 当前 `docs/M9_DATA_LEDGER.md` §1/§1.2 和 `provenance/manifest.json`：核对档案版本、固定来源地址及“缺失执行语义列 unknown”的政策；没有给出上述 Q3 边界结论。
- `82d815b0acf210f1269903a5db4df187230e144c:docs/evidence/s13-p1/experiments/DUO-LIMITS.md` 说明双排原型撤出、真实所有权/共享领取缺口，属于项目原型审计，不能代替“进入未知”原版行为证据。同目录 `s13-p1-anomalies.ts.txt` 只有贪财实验定义，不包含可用于确认 Q3 的实现。
- 检索当前 docs 的 IntoTheUnknown/进入未知/暂离/归来：P4 `PR192_OCCUPANCY_REVIEW.md` 讨论战斗内暂离占格，机制与跨轮托管不同，不能沿用为 Q3 证据。

### 3. 现有文档链接的官方补丁说明（本次联网复查）

- [Riot 14.24 公告](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)（2024-12-10，含 12/17 B 更新）：检查全文及 ANOMALIES/BUG FIXES、检索 Unknown；未找到“进入未知”上述边界规则。LOOT ORBS 段确有多单位球在容量不足时部分开启的说明，但那是战利品球的容量政策，不能推出跨轮暂离的归来政策。
- [Riot 14.23 公告](https://teamfighttactics.leagueoflegends.com/en-gb/news/game-updates/teamfight-tactics-patch-14-23-notes/)（S13 首发补丁）：检查全文及异常相关段、检索 Unknown；未找到上述 Q3 边界说明。
- 补充官方站内定向搜索 `"Into the Unknown" anomaly rounds` 与 `"Into the Unknown" carousel`，未取得能确认上述边界的有效官方结果。不把搜索无结果当成“原版不存在”或“已确认禁止”的依据。

## 分项结论

|问题|原版证据结论|本 PR 标记|
|---|---|---|
|有跨轮暂离及归来增益|raw 描述/效果量支持；本包未接内容|仅作为来源说明|
|满席归还时如何处理|所查来源不能确认|Q3 兜底项目约定：同实例托管至有位置|
|暂离可否出售、卸装或合星|所查来源不能确认|Q3 兜底项目约定：禁止这些交互|
|轮选是否计数|所查来源不能确认|Q3 兜底项目约定：计一回合|
|加时是否计数|所查来源不能确认；项目加时轮次也不能凭原版描述自证|Q3 兜底项目约定：计一回合|
|是否纳入新的正式报价内容|本次未作准入判定|Q6 不扩目录；Q7/Q8 不做|

## 证据版本与本次变更验证

- 原实现/原本地验证版本：`2989cc38353232d2f169ece6ee939b7839254c0c`。
- 联网读取 GitHub 的该提交 workflow_runs：**[CI #627](https://github.com/catfish-xn/cat/actions/runs/39198450528)**，run id `39198450528`，`completed / success`。这个成功结论只绑定原实现 SHA，不冒充本次文档追加提交的 CI 状态。
- 修改前已读 PR #198 最新正文/HEAD（仍为上述实现 SHA）、状态 `open / merged=false`，评论/评审合并时间线为空。本次只追加来源说明，保留原 PR 首两行 attribution 与他人内容。
- 本次只改三份 Markdown：本文件、`docs/S13_OWNERSHIP_TRANSACTIONS.md` 的 Q3 标签/引用、`docs/evidence/s13-d3/VALIDATION.md` 的证据版本补记。以 `git diff --check`、文件范围及实现树未变核验；不重跑代码测试，不重录，不更新指纹/digest/版本。文档追加提交 SHA 在 PR 与任务回报中给出，避免自引用。
