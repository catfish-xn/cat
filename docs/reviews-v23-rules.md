# v23 规则独立审查与定向测试

审查树：`/home/aiapps/workspcae/cat-cx-v23rev`；分支 `codex/v23-rules-review-tests`。
HEAD：`da2bedb5ec81121d39341303960be2ae85214cc2`，与 `origin/claude/v23-integration` 一致。
比较基线：`origin/multiplayer` = `2b434e28248232906a3251e0c56af68ca15c7bcf`。
未收到具体 `-o` 路径，报告默认落到本文件。

结论：发现 **3 项已复现的实现问题（2 项 P1、1 项 P2）及 2 项契约缺口**。建议先修复存档问题再合入/发布。仅新增测试，未修生产实现，未提交。

## 已复现问题（按优先级）

### V23-R3 · P1：合法赛恩冲锋状态无法保存或恢复

- 定位：`src/simulation/combat-g2-3-summons.ts:67`、`:73`；拒绝点 `src/simulation/serialization-structure.ts:512`（经 `:532` 的状态源校验）。
- 冲锋采用 `origin(u,1)` 给敌人附加带击飞标记的眩晕。存档的 ability/attack 来源却只允许 `effectIndex === 0`，中立例外不涵盖赛恩。这是新产生的合法来源与旧校验规则不兼容。
- 复现：seed 42，经正常回合入口到 2-1，通过领域授予入口准备莫甘娜、弗拉基米尔、卡西奥佩娅，开战并逐 tick 等待真实 `bindingChanged(bound=false)`。开战快照本身可保存；解缚后的真实快照在 `serializeMatch(state)`、`restoreMatch(state)`、`restoreMatch(JSON.stringify(state))` 全部报 `Invalid Match save: ability source identity`。
- 影响：至少在冲锋眩晕仍存在时，正常战斗存档/恢复被拒绝；不能将其解释为防篡改的正常拒绝。
- 测试：`tests/v23-review-restore.test.ts:108` 起；准备条件在普通 beforeAll 中验证，3 个 `it.fails` 仅包围“合法快照不应抛异常”的断言。
- 修复建议：明确声明并认证赛恩各 effectIndex 的用途，校验真实重放来源；不要简单放宽所有 ability effectIndex。

### V23-R1 · P1：新复活字段缺少结构、持有者与历史事实校验

- 定位：`src/simulation/restore-combat-replay.ts:53` 的重放事实未纳入 `g23Sion`；`src/simulation/combat-runtime-facts.ts:28` 起只认证旧的 Sion 释放标记；使用该字段改变可用性的入口为 `src/simulation/anomalies/availability.ts:17`。
- 复现：对已能正常 round-trip 的开战快照，在赛恩或普通莫甘娜上加入 `g23Sion:{reviveAtTick:500,revived:false}`，三种存档入口全部接受。赛恩上加入 `{reviveAtTick:-1,revived:'forged'}` 也被接受。
- 实际影响已验证：恢复后的普通莫甘娜在 tick 1 被 `isAbsent` 判断为缺席，原快照同一单位则在场；伪造状态保留到下一 step。这可以改变参战/锁敌情况。此结论针对 Match 存档入口，不宣称存在远程命令注入通道。
- 测试：`tests/v23-review-restore.test.ts:39` 起，9 个 `it.fails` 覆盖三入口、两种持有者与非法值；`:51` 起另有普通通过用例证明状态变化。
- 修复建议：校验字段形状、整数/布尔类型、单位身份、黑玫档位和时钟边界；将字段的存在性及完整内容纳入独立战斗重放事实，认证唯一复活次数及实际死亡时间。

### V23-R2 · P2：合法击飞标记可被增删，恢复不拒绝

- 定位：`src/simulation/m8/restore.ts:98` 起的旧状态投影校验没有认证 `application.knockup`；`src/simulation/restore-combat-replay.ts:55` 只抽取 burn 状态作该处历史认证。`src/simulation/m8/status.ts:34` 检查了值域，但不能认证某次真实眩晕是否应为击飞。
- 复现：合法获得并部署蔚，推进到真实主目标普通眩晕、同排目标击飞同时存在的快照。原快照能够保存、恢复并确定性继续。删除真实击飞的 `knockup`，或给主目标普通眩晕加 `knockup:true`，三种入口全部接受。
- 影响：存档可以改变击飞/普通眩晕显示及战斗投影。当前两者均按 stun 控制，没有证据表明只改这一位会改变伤害或规则上的禁行动时间，因此严重度低于 R1。
- 测试：`tests/v23-review-restore.test.ts:89` 起，6 个 `it.fails`；beforeAll 独立确认两种真实状态均存在。
- 修复建议：将该标记绑定至来源技能/具体效果，并与独立重放的真实贡献比较；保持 `true | undefined` 的现有值域限制。

## 契约与文档差异

| 编号 / 严重度 | 定位 | 差异及建议 |
| --- | --- | --- |
| V23-D1 / P2 | `docs/MATCH_CONTRACT.md:384`、`:396` | 合同仍描述单步 `lcg32-v1`，示例 configVersion 仍为 `opening-encounters-14.24b-pr1-v1`；实现 `src/simulation/opening-encounter.ts:85` 已改 fmix32，配置为 `opening-encounters-14.24b-batch-a-v2`。`docs/S13_RULES_GAP.md:882` 已说明新算法，但正式合同未同步。应明确覆盖旧算法和版本，避免按合同独立实现得到不同开局。 |
| V23-D2 / P3 | `docs/COMBAT_CONTRACT.md:274` | movement.reason 的接口示例仍只有两种安蓓萨原因；`src/simulation/combat-types.ts:134` 已增加三种强制位移原因。`docs/S13_RULES_GAP.md:179` 有行为说明，但战斗合同还缺新增联合类型、knockup 字段和 Sion 复活字段的恢复语义。建议添加 v23 合同条目并说明原普通眩晕与新击飞的区别仅在标记。 |

## 新增测试

所有新增文件均为 `tests/v23-review-*.test.ts`；没有改动任何既有测试或被禁止的目录。

| 文件 | 用例数 | 覆盖内容 |
| --- | ---: | --- |
| `tests/v23-review-controls.test.ts` | 10 | 蔚主目标 30 tick、同排 5 tick；维奥莱特 5 tick；瑟提 30 tick；精确 next-tick 生效/到期边界；普通晕/击飞均可打断引导与可取消任务；受控目标仍可被锁定；单独位移不自行打断引导；瑟提真实抓取当 tick 位移、下 tick 晕打断；安蓓萨拳套保持 5 tick、范德尔不额外施控；标记值域。 |
| `tests/v23-review-sion.test.ts` | 7 | 双方 numeric owner、准备数组重排不影响归属；3/4 档 175% AP、5/7 档 75% AP 护盾，60 tick 护盾和20 tick 普通线晕；20 tick 复活等待的缺席/锁敌/禁行动；JSON 恢复逐 tick 一致；复活免控、第二次死亡终结。护盾测试显式固定 AP=100，隔离初始策略的 AP 加成。 |
| `tests/v23-review-restore.test.ts` | 21 | 合法赛恩开局、合法蔚击飞 round-trip 和继续；3 个存档入口对新字段的认证与合法冲锋兼容性；其中18项为上述3个真实问题的预期失败测试。 |
| `tests/v23-review-opening.test.ts` | 3 | seeds 0..9999 全覆盖，BigInt 独立实现 FNV/fmix32，与每个实际 word、抽词计数及加权区间逐项比对；累计区间端点；旧版本/种子/word 篡改拒绝；完整分布回归。 |
| `tests/v23-review-loot-intern.test.ts` | 1 | 真实 m8/冻结掉落账本，构造 JSON 相等但引用不同的缓存命中；提交收据后必须保持当前 frozen/layoutBinding 引用；不可变、重复收据拒绝、不更改金币/RNG。 |

额外运行的既有相关文件：`tests/sion-rework.test.ts`、`tests/displacement-control.test.ts`、`tests/knockup-status.test.ts`、`tests/v23-small-fixes.test.ts`、`tests/control-display.test.ts`（38 项）。其中位移测试覆盖边界、占格/预留格、固定物/控制免疫、真实施法、事件顺序、回放及对方镜像；没有运行其他测试文件或全量套件。

## fmix32：0–9999 分布结果

16 个加权条目全部出现；10000 个选择词无重复；Pearson χ² = **18.534**（15 个自由度），回归阈值为60。该固定窗口用于发现相邻小种子的集中退化，不把它作为随机性证明。实际 word 还全部通过独立 BigInt 算术对照。

| 条目 | 实际次数 |
| --- | ---: |
| none | 994 |
| prismatic-party | 453 |
| wind-up-monkey | 502 |
| trainer-golems | 398 |
| component-anvils | 1031 |
| crab-rave | 219 |
| artifact-anvil | 418 |
| viktors-vision | 802 |
| gold-subscription | 408 |
| prismatic-prelude | 620 |
| warwicks-hunger | 815 |
| golden-gala | 1003 |
| scuttle-puddle | 799 |
| mels-blessing | 751 |
| prismatic-finale | 407 |
| loot-subscription | 380 |

## 验证结果

- 10 个定向文件全部完成：**80 项，其中62项普通通过、18项按预期失败；0项意外失败、0项跳过**。新增42项，既有相关用例38项。18个 `it.fails` 对应 R1 的9项、R2的6项、R3的3项；它们保留正确预期，生产问题未修复，不能据此宣称规则无缺陷。
- 完整定向组合运行耗时13.00秒，机器结果在 `/tmp/v23-review-vitest-results.json`。随后仅对 loot 新测试的 gold payload 类型字段作 `amount → quantity` 修正，并单独重跑该文件：1项通过；不影响其他测试。
- 类型检查：最终 `npm run typecheck` 通过（退出码0）。

复现定向组合命令：
```bash
export PATH=$HOME/.local/bin:$PATH
npm test -- --configLoader runner \
  tests/v23-review-controls.test.ts tests/v23-review-loot-intern.test.ts \
  tests/v23-review-opening.test.ts tests/v23-review-restore.test.ts \
  tests/v23-review-sion.test.ts tests/sion-rework.test.ts \
  tests/displacement-control.test.ts tests/knockup-status.test.ts \
  tests/v23-small-fixes.test.ts tests/control-display.test.ts
npm run typecheck
```


执行命令均先 `export PATH=$HOME/.local/bin:$PATH`。默认 Vite 配置打包会尝试写只读 node_modules 下的 `.vite-temp`，首次启动因此失败；改用 `--configLoader runner` 后正常执行，不修改配置或依赖。

## 证据与审查边界

- 已读取用户指定的 `s13-control-sion-decisions.md`，以及本地研究包 `report-zh.md`、字段摘录和 `HANDOFF.md`。按批准决策保留范德尔无嘲讽、安蓓萨/蔚次级控制0.25秒、赛恩1秒复活延迟等项目约定；没有把研究中“未确认”的执行语义改称原版事实。
- 比较包括 sion-rework、knockup-flag/xgn95z、displacement-2d-slide/zozrva、h0kxn5 合并后的当前实现。比较基线到 HEAD 还包含强化池等大量不属本次目标的改动，未宣称完成整树全面审计。
- 2D slide 仅做代码与纯数据测试审查，没有启动 Chromium 做实际画面验收。未发现此次滑移接线自行结算规则；不宣称视觉效果已实机验证。
- 7 黑玫复活的逐 tick JSON 恢复验证使用隔离 CombatState；完整 Match 合法保存验证使用3黑玫开局和真实冲锋。尚未构造完整合法7黑玫、死亡前后全链路 Match 存档向量；不能将这一部分描述为已通过。
- 没有编辑 src/、docs/evidence/、受禁 fixtures、脚本或既有测试；没有 git commit、切分支或执行 git 写入。
