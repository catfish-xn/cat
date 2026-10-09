# B7 current integration handoff — accepted integration merged; cleanup follow-up

**Current scope supersedes the historical narrowed-subset record below.** All eight fixed encounters, 12 neutral definitions and 25 deployments now run through ordinary Match Start/step. Herald uses the accepted upstream damage-before-control fix; its old lethal characterization is replaced by retained lethal/no-stun and added surviving/damage-before-stun assertions. Nothing in the historical “Herald incomplete” section is a current acceptance claim.

## Accepted checkpoint and cleanup scope

- Per the user's confirmation, Claude accepted fixed commit `889a2a5cab70afc6769b1746fcb0ecb9fa1c2737` with no blocking findings. The full independent audit report/vectors have not been supplied here; this records that confirmation, not a replacement audit or self-signoff. [Approval archive](https://github.com/catfish-xn/cat/pull/21#issuecomment-6091221857).
- [CI161](https://github.com/catfish-xn/cat/actions/runs/37970916638) passed on its first attempt: 13 required checks green, two optional checks skipped; unit tests 111 files, 1422 passed and 10 existing approved skips. This is remote CI evidence; local Chromium remained blocked and is not claimed as locally passed.
- PR #21 merged into `feat/m8-b0-baseline` at `87782695f864ba5d493d7a40c9c3652b48aacc86`, parents `947ac7151e180a70446aeece09d8c9e500f2a4b9` and accepted `889a2a5cab70afc6769b1746fcb0ecb9fa1c2737`, tree `00700f1dc32376212ff81104958d6e3cbbe4f47d`.
- Authorized follow-up `chore/m8-b7-cleanup` derives restore control timing from the trusted duration/task, confines zero maximum mana to neutral units, and documents observation receipts. New independent local regression vectors supplement the existing tests; Claude's separate audit-vector branch remains pending delivery by the user and is not fabricated or replaced here.
- B8 has not started. Its equipment-catalog changes must also update corresponding strict restore assumptions and tests: [issue #23 reminder](https://github.com/catfish-xn/cat/issues/23#issuecomment-6091227862).

## Scope and integration

- Approved baseline `947ac7151e180a70446aeece09d8c9e500f2a4b9` was merged into existing `feat/m8-b7` without textual conflicts. Remote merge `da801827d8fd267fef23c1648f091af4baf4c55c` has parents original `469afdae118c81e8c8ec44bc96b139552915455f` and 947. No rebase or forced update.
- Neutral runtime binds trusted companion/opening/cone declarations to real fixed instances, zero mana, fixed one star and 25%/1.4× basic-attack crit. It reuses B3; no parallel damage/control engine.
- `readEncounterPreview` exposes frozen public enemy identities, positions, resolved statistics and implemented rule summaries. Supply returns null; PvP stays separate; no hidden drops, RNG or special encounter pool.
- ENCOUNTERS §3 permits cost-1 legacy display/stat adaptation. Authoritative `NEUTRAL_DEFINITIONS` has no cost. Legacy adapter neutrals have empty traits, cannot enter shop/player acquisition/player restore, and are not purchasable. Old UI may display “1费”; accurate neutral badges/details are U5 work.
- Narrow B7 restore validates catalog-bound identity, immutable declarations, opening and companion one-shot consumption, source/effect/target identity and exact status lifetime. Observation-only death/control receipts reject retimed krug healing and deleted Herald stun without changing events, effects or RNG. This is structural same-version consistency, not cryptographic authenticity against jointly forged entire histories.
- B8 remains explicitly pending: `encounterPlan=null`, contentStatus `ready-b7-pending-b8`; no fake empty loot plan. B9 formats/capacity, frozen contracts, G12, UI and CI/gates remain untouched.

User-approved project convention: B6's fixed PvP round has no encounterId, so readonly preview uses `pvp:<roundId>`. UI must not use this preview identifier as an asset key or loot key. This changes no round identity, formation, random draw or game state.

## Validation and evidence

- Baseline merge: original `npm test`, 110 files, 1392 passed / 10 existing skipped, 499.07s; [baseline evidence](evidence/m8-b7/baseline-merge/README.md).
- Final-source typecheck and production build pass. B7 focused wiring: 30 cases pass, including all eight real encounters, canonical save/restore/resume, mutation rejection, 0/1/2 early aura identities, QSS/EON, and initial-versus-first-step opening event boundaries. Independent QSS/EON/no-item Herald probes also round-trip every tick to terminal1200; no reachable active-stun EON cleanse was observed, so that branch is not claimed as real-battle covered.
- First isolated integrated full run: 1416 passed / 4 failed / 10 existing skipped, 477.91s. All four failures were the old M6 assumption that every eventual event tagged tick0 belonged to captured initial state. The approved test adaptation compares an independent ordinary Start result instead; every original subsequent trajectory/hash/seek assertion remains. B3 and Playback are unchanged. See [full logs, old/new assertion rationale and restore evidence](evidence/m8-b7/integration-receipts/README.md).
- Second isolated full run on local `8f5959ef9222bc31d07f840ed81406f85c6cc144` / remote `06912ce8966bb3430e7d82c2b91d4c5ce7f77486` was **interrupted**, with no terminal summary; no pass is claimed. CI157/158 both hit the unchanged 5000 ms B6 late-round fixture timeout. The test-only 9-hero/27-item → 3-hero/9-item adjustment preserves all 33 real battles, 38 settlements, original assertions and nine late restore boundaries; all samples and rationale are in [fixture-cost evidence](evidence/m8-b7/fixture-cost/README.md).
- **Final isolated original `npm test`: 111 files passed; 1422 passed / 10 existing skipped (1432 total), exit0, 506.99s.** Fixed local `e1c48aa8352b285117097fafd497bfd1699e2750` and remote `57137c214381a1633587db8ce7b74f1fba1de15d` share tree `45d68632002279b38269ccbd4e0621a3e43c7d98`. All M6 per-tick/hash/seek checks and the unchanged B6 timeout pass. [Raw complete log](evidence/m8-b7/integration-receipts/final-full-unit.log.gz).
- Runtime/build output is unchanged after the earlier successful typecheck/production build. Later changes are tests and evidence only. This earlier pending state is superseded by the accepted checkpoint, CI161 and PR #21 merge recorded above. Cleanup changes still require their own verification and later independent review.
- Golden migration preserves the exact old 947 fixture. Independent comparison proves unchanged four-route commands, economics, rewards and Match RNG streams. Eight PvE event streams change; cannon's nine additional PvP changes trace solely to one extra +125 bps Tristana growth at 4-7. [Reproduction and detailed proof](evidence/m8-b7/golden/README.md). No golden assertion, skip or threshold was relaxed.

## Budget and remaining limits

Node22.23.3 `zlib.gzipSync(bytes,{level:9})`, all production JS: **485743 B**, versus exact rebuilt 947 **480941 B**, delta **+4802 B**. The user accepted this **+4802 B** increase, which exceeds the preferred B7 +4000 B by **802 B** after attempted deduplication; safety checks and independent consumption receipts are retained. The unchanged effective ceiling is **488477 B**, leaving **2734 B**. Final CI paired measurement remains authoritative; no budget/method change.

The domain preview is currently tree-shaken because U5 has not imported it. Its first UI use has an unknown additional bundle cost; this is not a zero-cost delivered preview UI. Synthetic late-round fixtures use explicitly documented earlier wins and strong test heroes, not an honest full-campaign/balance claim. Four real seed42 routes still have zero fully formed battles and five component grants under existing B8/B9 deferrals. Stage1 specified-hero vectors are fixture boundaries, not implemented B8 rewards.

## HISTORICAL RECORD ONLY — superseded narrowed subset, not current acceptance

Historical narrowed-subset handoff below is preserved as evidence of the earlier blocked state; its “no runtime imports” and “Herald incomplete” statements are superseded by this active integration section, not retroactively rewritten.

---

# M8 B7 独立内容子集交接（范围缩小，未签收）

## 状态与范围

2026-10-09；固定接手基线 `5bd7968ee31e107e12701145aa4fdac0bec7ea8d`，分支 `feat/m8-b7`。

**本步未签收。用户已同意先交付独立目录、编译器和问题证据；先锋机制标为未完成，修复另行安排。** 不继续扩展功能，后续完整 CI 和独立 Pro 审计仅验收该缩小子集，不把先锋机制计为完成。
三份新增运行模块已由协调者保存到 checkpoint `4d84c5012362cfd22db03383947f47b2387672de`；本文和测试是该 checkpoint 后的交接补充。独立审计、最终验收及合并均未进行。

本步只准备批准的中立目录、阵型、纯编译器及复用既有 B3 的独立向量。没有启动正式 Match 遭遇；正式接线须等 B6 二期合并及新的后续授权。设计来源为 `M8_PLAN.md`、`docs/M8_DEPENDENCY_MAP.md`、`docs/M8B_ENCOUNTERS.md`、`docs/M8B_CONTRACT_ADDENDUM.md`、`docs/M8B_POLICY.md`。所有数值是已批准的项目首版，不代表 14.24b 完整历史还原或实战平衡通过。

## 本步文件清单（全部新增）

| 文件 | 交付内容 |
| --- | --- |
| `src/simulation/content/neutrals.ts` | 12 个独立中立定义，显式 family、固定一星、HP/AD/AS/双抗/射程、AP100、0/0 法力、2500/14000Bps 基础暴击及五类机制声明；无商店 cost 占位、无装备、无羁绊 |
| `src/simulation/content/neutral-encounters.ts` | 8 场、25 个部署槽的 roundId/encounterId/slotId/definitionId/坐标；阶段 1 数量为 2/3/4 |
| `src/simulation/neutral-encounter-compiler.ts` | 独立纯函数 `compileNeutralEncounter(roundId)`；拒绝非目录轮次，校验部署区/槽/格位，输出冻结部署与 B3 CombatUnit/开场声明 |
| `tests/m8-b7-catalog.test.ts` | 5 项目录/编译测试，完整独立表、25 个身份/站位、机制 source、冻结/确定性、现有目录隔离 |
| `tests/m8-b7-mechanisms.test.ts` | 21 项真实新目录编译产物的 B3 执行及局部 JSON 续算向量 |
| `tests/m8-b7-known-limitations.test.ts` | 1 项已知偏差的现状复现；不是批准语义的通过证明 |
| `docs/M8_B7_HANDOFF.md` | 当前交接、实际检查、阻塞和后续接点 |
| `docs/M8_B7_DAMAGE_CONTROL_ORDER.md` | 用户追加授权的开发者问题记录：先锋最小复现、预期/实际、基线接点、后果与未实施的修复方向 |

临时 `node_modules` 符号链接仅用于本地复用与当前锁文件相同的依赖，不属于提交文件。未修改 package/lock、任何既有源文件、既有测试、冻结合同/G12、UI、CI 或门禁。

## 纯编译边界与既有执行器复用

- 入口仅接受显式 roundId，输出 `roundId/encounterId/catalogVersion/policyVersion/encounterRngDraws/deployment/units/openingDefinitions`，不接受或消耗 RNG。
- 实例 ID 为 canonical JSON 数组 `["pve", roundId, encounterId, slotId]`，不使用数组序号或旧 round 整数。所有实例固定敌方一星。
- 目录中的 family 是显式数据。机制编译分支依据有限 `mechanism.kind`，不按定义 ID 或中文名称分支执行。
- 通过既有 `attackInterval` 和 `compileUnitInputs` 编译基础 AS/暴击；没有直接给测试对象手塞 spellCrit=2500 来冒充内容编译。
- 石甲虫/鸟映射到既有 `companionDefinitions`；狼/先锋映射到 `openingDefinitions`；龙映射到 `attackCone`。伤害、治疗、控制、死亡清理、开场几何及 RNG 均由既有 B3 执行器处理，没有新增一套战斗循环。
- `catalogVersion=m8b-encounters-project-v1` 与 `policyVersion=m8b-pve-project-v1` 是批准设计中的目录/政策身份元数据，不是全局版本切换。`content/index.ts`、内容 digest、规则版本和序列化均未改变。
- `NEUTRAL_DEFINITIONS` 独立于当前 `UNIT_DEFINITIONS` 和 `SHOP_CATALOG`；没有加入英雄获取池、羁绊或装备池。

## 已执行的独立数值与边界向量

| 场景 | 已核验结果 |
| --- | --- |
| 所有 8 场真实编译结果各推进 50 tick | 无施法，所有新中立始终 0/0 法力；输入未被改写。这不是完整对局/平衡验收 |
| 石甲虫两只同 tick 正式死亡 | 当 tick 不治疗；两笔任务在下一 tick 执行并各自即时取样缺血 |
| 缺血 200、3300Bps 重伤 | `floor(200×0.67)=134`，再 `floor(66×0.67)=44`，最终 HP378；无重伤为 200+0，最终 HP400 |
| 石甲虫在治疗执行 tick 被致死 | 不复活、不治疗，反应取消 |
| 五狼/单个后排目标 | 按稳定 ID 预订四个相邻格，第五狼 no-space 消费一次；输入顺序不影响计划；0 伤害/0 RNG，续算不重跳 |
| 鸟 0/1/2/5 死亡层数 | 下一 tick 间隔为 25/22/20/15，等待冷却 7 只递减为 6；逐死者贡献、无双重延期、无重复层 |
| 鸟真实小鸟死亡 | 同族大鸟于下一 tick 从 25 改为 22 tick，每死者固定 1500Bps |
| 龙 word0（前驱 RNG 状态 634785765） | 85AD 主包119，最多两个副包各29；主目标500→381、次目标500→471；全动作只消费一个词，不递归普攻 |
| 先锋合法开场路径 | `(3,1)→(4,2)→(3,3)→(3,4)→(2,5)`；tick1 伤害任务一次，目标 maxHP1000/4000 分别150/300原始魔伤；存活者眩晕 `[2,12)` |
| 先锋免控/完全防伤 | 免控阻止眩晕；完全防伤不阻止眩晕。存在下节所述致死/事件时序偏差 |

鸟的 0/1/2/5 层批量向量明确使用“合成的正式死亡清理后边界”，不是声称这些死亡全由实战击杀模拟；另有一项真实小鸟死亡端到端验证。局部 JSON 往返只检查相同 CombatState 的确定性续算，不代表 Match/save/replay 恢复验证器已接受这些新内容。

## 阻塞：先锋控制早于伤害提交

批准语义（`M8B_ENCOUNTERS.md §4.5`）：冲锋先造成伤害，随后只给仍存活且不免控的目标施加从下一 tick 开始的 10 tick 眩晕。

当前复现（`tests/m8-b7-known-limitations.test.ts`）：

1. 使用 `compileNeutralEncounter('6-7')` 的真实先锋，冷却固定以隔离冲锋；目标位于 `(3,4)`，maxHP1000、currentHP100、魔抗0、无盾。
2. tick0 先锋位移到 `(2,5)`；tick1 请求150原始魔伤。
3. 既有引擎先记录 `statusChanged(reason='applied', kind='stun', startsAtTick=2, expiresAtTick=12)`，之后记录致死的 `packetDamage(raw=150,hpDamage=100)`。
4. 死亡清理再移除眩晕；目标最终死亡且无存留状态，但已经出现不符合批准先后顺序的施加事件，也向最终致死目标施加过控制。

根源是基线 `src/simulation/combat-s13.ts:193–199` 顺序调用开场 effects；`src/simulation/m8/s13-mechanisms.ts:90–91` 对 damage 只排待结算包，而同文件 `:96` 对 apply-status 立即登记。该差异来自既有通用执行器，新目录首次用完整先锋伤害+控制内容揭示它。

本步没有修改通用层，也没有通过特殊 ID 判断或独立战斗结算规避。现有 damage-dealt 触发依赖正伤害，不能简单替换为它，否则“完全防伤不等于免控”也会改变。用户已决定本步先交目录/编译器及证据，先锋修复另行安排。开发者可直接使用的记录见 [M8_B7_DAMAGE_CONTROL_ORDER.md](M8_B7_DAMAGE_CONTROL_ORDER.md)。

**已知偏差测试是 characterization：它的绿色只证明偏差可稳定复现，不能记为批准的先锋存活过滤/事件时序验收通过。**

## 实际检查与未执行项目

使用已安装的 Node **22.23.3**（与当前 CI 版本一致），依赖锁文件在复用前已比较一致。

```sh
npm run typecheck
npm test -- tests/m8-b7-catalog.test.ts tests/m8-b7-mechanisms.test.ts tests/m8-b7-known-limitations.test.ts
```

暂停时的定向检查：typecheck 通过；**3 个测试文件、27 项测试通过**，其中1项为上述已知偏差的事实测试。未使用实现输出生成预期快照或替换既有 golden。

范围缩小获批后的最终本地检查，代码/测试固定于 `3b0d55f923d7225587872340f62b203de31f8f41`，检查期间未修改文件：

| 命令 | 实际结果 |
| --- | --- |
| 原样 `npm test`（无并发/超时/筛选改写） | **102个测试文件、1266项全部通过**，退出码0，445.43秒；该总数包括1项明确命名的已知先锋偏差现状证明 |
| `npm run build` | **通过，退出码0**；包含 typecheck + Vite production build，126 modules，Vite构建5.36秒 |
| `git diff --check` | 通过 |

build仅有现有大chunk提示及环境UNDICI/http-proxy警告，没有改门禁/配置压制警告。构建生成物不提交。

浏览器/性能/输入/完整 Match 专项门禁未在本地执行；远端最终CI及独立Pro审计由协调者另行完成，本文不提前声明结果，也不自签。暂停消息到达前正在编写的额外边界测试因一个未完成的类型声明未通过，已移除该未完成文件，随后重新执行定向与上述全量检查通过；该文件不在交付中。

隔离证明：从固定基线比较，运行源差异只有上列三个新增模块；扫描全部 `src/**/*.ts` 对 `neutral-encounter-compiler`、`content/neutrals`、`content/neutral-encounters` 的引用，只有新增编译器对两个新增目录的引用。没有任何既有运行入口 import 新模块。目录测试另证明12个新定义都不在现有单位登记和商店中。

## 后续接点（未获本步实施/签收）

1. 按用户最新决定只验收独立目录/编译器/证据子集；完成全量检查及独立 Pro 审计前不签收。先锋机制保持未完成，修复另行授权，不改通用层。
2. B6 二期合并后由共享文件 owner 正式接入 round-enemies、开战快照、公开预览、内容校验/digest 与版本/恢复；不要只向旧守卫叠加字段。
3. `deployment` 只是隔离部署数据，现有 `getUnitStats`/Match/序列化不认识这些新定义；不能直接混入现有 Match 并声称可保存。
4. 把新目录/机制声明纳入同版本可信内容校验、开场/死亡消费状态和零蓝/暴击投影恢复；执行8场完整遭遇、阶段1主路线及平衡观察。
5. B8 掉落与唯一收据、B9完整恢复/回放及B10最终验收仍在各自授权范围内，不由本子集替代。
