P3-A/P4-A/P5-A 单包完成：PvP `overtime-n` 从首场起基础扣血17，普通stage2–6及存活敌人每个1不变；P4保持76升9与9级上限；P5保持球数/配比，采样改读冻结ORB_RULES。基线 `multiplayer@66395eb`（≥8d7f08e），不部署/合main。

**测试过了吗？** 是。最新基线 `npm run typecheck` 通过；指定目标 Vitest **17文件 / 267用例通过，0失败、0跳过**（38.62s）；`npm run test:server-entry` 通过（Node/browser逐状态事件/RNG字节对比、恢复续算、隔离CLI与预算校验）。首次server-entry在沙箱spawnSync EPERM，获自动批准后正常执行；没有放宽预算。未跑全套，合并树由指挥跑一次。

```sh
npx vitest run tests/match-economy* tests/m5-economy* tests/t2-two-sided* tests/t3-round-settlement* tests/t5r-overtime* tests/progression* tests/m8-b8-live-economy* tests/r3r4-loot* tests/m8-b8-loot-freeze* tests/m8-b8-loot-runtime* tests/m8-b8-loot-view* tests/t3-timeout-loot* tests/t13-identity* tests/m8-content-equivalence* tests/server/round-commit.test.ts
node scripts/record-p3p4p5-release.cjs --check
```

独立向量覆盖普通/首场/后续加时，1/3/9混合费用星级存活者、双方交换、胜/平/败、镜像零结算、HP clamp、恢复BattleInput重演、旧12点收据拒绝、重复提交；P4既有75+1→9与满级拒买原state/全部字段无副作用；P5固定0/49/50/89/90/98/99及全部100个index等于旧结果，拒绝采样draw游标、八席模板/部分击杀/重连零额外RNG通过。

**越界了吗？** 否。仅改 `src/simulation/`、`tests/`、`scripts/`、`docs/`；不改服务器/界面/协议。文件清单如下。

- `docs/MATCH_CONTRACT.md`
- `docs/MULTIPLAYER_CONTRACT.md`
- `docs/MULTIPLAYER_RELEASE_NOTES.md`
- `docs/P3P4P5_RELEASE.md`
- `docs/PR_P3P4P5.md`
- `docs/S13_RULES_GAP.md`
- `docs/evidence/p3p4p5/overtime-first-difference.json`
- `docs/evidence/p3p4p5/release-audit.json`
- `scripts/record-p3p4p5-overtime.cjs`
- `scripts/record-p3p4p5-release.cjs`
- `scripts/verify-t1-node-entry.cjs`
- `src/simulation/content/orbs.ts`
- `src/simulation/content/rules-manifest.ts`
- `src/simulation/economy.ts`
- `src/simulation/m8/contracts.ts`
- `src/simulation/m8/version.ts`
- `src/simulation/match-rules.ts`
- `src/simulation/orb-layout.ts`
- `src/simulation/round-settlement.ts`
- `src/simulation/two-sided-battle.ts`
- `tests/fixtures/m5/assert-golden.cjs`
- `tests/fixtures/m5/full-match-golden.p3p4p5.json`
- `tests/fixtures/m8-golden-states.cjs`
- `tests/fixtures/p3p4p5-recorded-states/cannon.json.gz`
- `tests/fixtures/p3p4p5-recorded-states/sniper.json.gz`
- `tests/m5-economy-p3-selector.test.ts`
- `tests/m8-contracts.test.ts`
- `tests/match-contract.test.ts`
- `tests/p3p4p5-content-baseline.json`
- `tests/r3r4-loot-weights.test.ts`
- `tests/t13-golden.test.ts`
- `tests/t13-identity.test.ts`
- `tests/t2-two-sided-battle.test.ts`
- `tests/t5r-overtime.test.ts`

**改玩法了吗？** 是，仅P3加时基础12→17（项目映射stage7政策）；P4/P5数值保持。扣血selector由economy、proposal、唯一收据校验同源调用，恢复编译输入后重演同源，禁止客户端/服务端补5。schema7/save3/replay3/command3、NET_PROTOCOL2不变。

| digest | 旧T13/当前发布 | 新包最终canonical |
| --- | --- | --- |
| CONTENT_DIGEST | fnv1a32-utf16:bd9c3a8e | fnv1a32-utf16:77f80fec |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:5cd0487c | fnv1a32-utf16:b8d9d7ca |

三项完成后共同manifest一次冻结，细分版本player-damage-overtime-v2 / nine-levels-v1 / orbs-project-v2与frozen-cumulative-weights-v1；外层rules/content为s13-rules-gap-v2 / s13-14.24b-rules-gap-v2。两个digest同批canonical生成，不预填运行时hash。旧档只读保全/导出、拒绝旧digest续玩、不迁移重抽，原因已写MULTIPLAYER_RELEASE_NOTES。

首次差异示例：真实旧99d9eff与本包相同输入的 `overtime-1` 空对空tick0平局，proposal baseDamage/damage **12→17**，唯一收据HP **100→88** 改为 **100→83**。terminal/战斗事件/收入/XP/RNG完全一致。3个存活普通敌人则15→20；可能提早淘汰改变后续配对和名次。

公开命令实跑四条完整路线后录制新golden/baseline/m8-content-equivalence状态，原T13与全部历史原件保持SHA不变。普通阶段/P4/P5的735条命令、132场回合事件不变，134个before/after/final完整状态仅四项发布身份替换后逐字段相同；首战events/RNG trace等于旧基线。移到最新基线后`--check`再次完整执行路线与恢复，逐字节核对已录制artifact而不重写。证据：`docs/evidence/p3p4p5/release-audit.json`与`overtime-first-difference.json`，说明：`docs/P3P4P5_RELEASE.md`。
