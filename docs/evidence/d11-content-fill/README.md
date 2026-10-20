# D11 内容扩容预检：接线阻塞，未实施新条目

基线为最新 `origin/multiplayer` 完整 SHA `a0d42c592cbd48fb075175e5f61818dabfe1b320`（2026-10-20 核实）。远端指定分支原先不存在；从此 SHA 新建 `codex/content-augments-anomalies-fill`。本 PR 只新增审计文件；D11 尚未完成，不可作为扩容完成验收。

## 已确认的边界阻塞

1. 已读基线 `AGENTS.md`。`/workspace/.agents` 是空目录，仓库无 `.agents/skills`；仓库、环境均未提供用户所指“10-19 内容包规则第 5 节”。`docs/DISPATCH_2026-10-14.md` 和交接记录不能替代该规则，未假定已读。继续实施前需父会话提供其原文或可访问路径。
2. `src/simulation/content/augments.ts` 用静态 import 引入 P1/P2/P3，再经 `freezeContent({...})` 构造唯一 `AUGMENT_DEFINITIONS`；`content/anomalies.ts` 同理展开 P2/P3/G23/P4。检查 content、anomalies 与 augment 领域模块，未发现自动目录发现、动态 import 或可通过新增文件触发的注册接口。`content/freeze.ts` 递归 `Object.freeze`，无法事后注入。
3. `src/simulation/augment-offers.ts::augmentCandidates` 枚举上述强化目录，并从现有 `content/augment-policy.ts::AUGMENT_TIERS` 读取等级。新强化即使另写定义文件，也必须编辑已有目录和等级表才会进入候选；异常亦需编辑已有异常目录。最低接线涉及 `content/augments.ts`、`content/anomalies.ts`、`content/augment-policy.ts`；新 mechanic 可能还涉及执行器与恢复边界。
4. `content/index.ts::CONTENT_DIGEST` 的输入含 `augments`、`anomalies`、`augmentTiers`。激活内容会重新计算 digest；本任务禁止改 digest，因此也不能以“只改定义、不改常量”为名规避身份变化。

因此停在注册之前，未创建孤立实现冒充已生效内容包，未编辑上述文件。此阻塞为任务边界导致，未涉及自动审批拒绝。父会话需先确认接线与身份策略，或提供已有且尚未找到的增量注册入口。

## 新增清单、来源准入与去重

运行时实际导出强化 57、异常 52，两目录均被冻结；CONTENT_DIGEST 为 `fnv1a32-utf16:ea6b11b6`（esbuild 打包 `content/index.ts` 后读取）。目标差额分别为 3、5。

新增强化 **0**；新增异常 **0**。先决接线失败，未开始候选准入；没有声称任何未实现条目已具备标准池证据或通过去重。故本轮不存在新增项的来源/标准池准入/去重/主效果数值测试对账，不能把基线测试当成新增数值测试。14.24b 已有覆盖值（例如 Built Different）全部保持。

## 强化等级概率研究

结论：保持当前项目等权（`deriveAugmentTier` 使用派生 LCG 词对 3 取模），不激活新权重。**权重改动待用户确认**；本 PR 无权重提案提交，亦无拟激活的具体权重。

查过以下来源：

- [Riot 官方 14.24 补丁及 12 月 17 日 B 补丁](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)，`SYSTEMS / OPENING ENCOUNTERS` 明列 Prismatic First 从 10% 到 6%、Prismatic Last 从 8% 到 4%。这两项是开局奇遇概率，不能直接当作每个强化节点的银/金/彩概率。该文未给出足够的完整强化等级联合分布与条件关系来取代当前项目约定。B 补丁的 Built Different 数值覆盖亦在同页，未动它。
- 仓库归档 `src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz`，检索 record 名称、键和 `mName/name` 的 augment、table、tier、odds、chance、probability、weight。存在 `TFT3/5/6/7/8/9_AugmentArmoryConfiguration_Table`、教程与 PvE 表；具体指针、原始字段、SHA256、按名称/指针反查的直接引用见 `preflight.json`。例如 `{03b5c964}.mConstants` 是 TFT6 表，`{e777fd5a}.mConstants` 是其 Early/Mid/Late Option1。其历史前缀本身既不能证明无效，也不能证明 S13 使用；本轮未建立它们到 S13 标准模式和开局奇遇覆盖的完整选择链，故不能采用。
- 同目录 `en_us.json.gz`（SHA256 见 JSON）作为归档来源边界记录；数据条目/强化等级身份不能替代出现概率。
- `docs/AUGMENT_TIER_V14_IMPLEMENTATION.md` 和 `content/augment-policy.ts` 现有说明将等权标为项目约定，非历史概率证据；本轮未改变此结论。

这些研究只说明未获得足够依据，不断言 Riot 无公开概率或归档不含可进一步解码的数据。

## 验证与限制

只跑内容、强化、异常相关 12 个完整测试文件：237 通过、0 失败；Vitest 7.41 秒，shell 实耗 7.897 秒，原日志在 `targeted-tests.txt`。tsc 通过，测量耗时与退出码在 `validation.json`。未跑全套、未调时限/门槛、未删/跳测试；没有新增运行时效果，因此没有新增主效果测试。

依赖安装首次因默认缓存路径不可写失败，改用 `/tmp/d11-npm-cache` 后 `npm ci --no-audit --no-fund` 成功，未修改锁文件。GitHub CLI 的现有 GH_TOKEN 无效；PR 创建优先使用已验证可读的 GitHub connector，推送结果另行在父会话回报。

只使用云端 `/workspace/cat` 与 `/tmp`，未访问本机、素材、D7 或 TASKS.md。结果由父会话写回任务入口。未合并、未改写历史。后续扩容必须重新按第 5 节做候选逐项准入、去重、数值测试；本 PR 不解除任何内容门禁。
