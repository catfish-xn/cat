P3-A/P4-A/P5-A 单包完成：PvP `overtime-n` 从首场起基础扣血17，普通stage2–6及存活敌人每个1不变；P4保持76升9与9级上限；P5保持球数/配比，采样改读冻结ORB_RULES。基线 `multiplayer@66395eb`（≥8d7f08e），不部署/合main。

**测试过了吗？** 是。本次夹具修复后 `npm run typecheck` 通过；下列指定目标 Vitest **5文件 / 61用例通过，0失败、0跳过**（42.13s）；`node scripts/record-p3p4p5-release.cjs --check` 通过。未跑全套。沙箱内两次仅 B8 replay 真实时间预算失败（371.29ms、321.29ms > 50ms），六条旧身份失败均消除；自动批准后沙箱外原样串行跑同一命令全部通过，未改预算、测试断言或规则。上一轮规则目标集的17文件 / 267用例与server-entry通过记录保留，不能与本轮61例相加当成一次验收。

```sh
npm run typecheck
npx vitest run tests/c19-missed-pulse.test.ts tests/m8-b7-match-wiring.test.ts tests/b8-resumable-battle.test.ts tests/t13-identity* tests/m8-content-equivalence*
node scripts/record-p3p4p5-release.cjs --check
```


独立向量覆盖普通/首场/后续加时，1/3/9混合费用星级存活者、双方交换、胜/平/败、镜像零结算、HP clamp、恢复BattleInput重演、旧12点收据拒绝、重复提交；P4既有75+1→9与满级拒买原state/全部字段无副作用；P5固定0/49/50/89/90/98/99及全部100个index等于旧结果，拒绝采样draw游标、八席模板/部分击杀/重连零额外RNG通过。

**越界了吗？** 否。仅改 `src/simulation/`、`tests/`、`scripts/`、`docs/`；不改服务器/界面/协议。文件清单如下。

- `docs/evidence/p3p4p5/FIXTURE_MIGRATION.md`
- `docs/evidence/p3p4p5/fixture-migration.json`
- `scripts/record-p3p4p5-fixture-migration.cjs`
- `tests/fixtures/c19-seed-9-minimal.json`
- `tests/fixtures/t13-herald-raw/edge-of-night.json`
- `tests/fixtures/t13-herald-raw/evenshroud.json`
- `tests/fixtures/t13-herald-raw/ionic-spark--evenshroud.json`
- `tests/fixtures/t13-herald-raw/ionic-spark.json`
- `tests/fixtures/t13-herald-raw/manifest.json`
- `tests/fixtures/t13-herald-raw/quicksilver.json`
- `tests/fixtures/t13-herald-raw/trajectory.json`
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

**本次六条失败修复与字节证据**

C19 以真实发布前 `66395eb3eb9a215975baa70c37f49e3ef4c97811` 为旧引擎，校验153份simulation源码与Git原件逐字节一致。保留6-1、battleId和种子3706951144及双方原始描述，在新身份下调用公共 `compileBattle` 重编译整份夹具；mapping/preparation/strategy与旧编译输出一致，所以生成文件差异恰好只有双方digest，但操作不是编辑digest字段。旧/新真实引擎的完整terminal（23276字节）、208条事件（166434字节）、15个灼烧脉冲（14192字节，Ezreal 5 / Garen 10）直接Buffer.equals，无身份归一化，仍为tick244 / enemyWin。前后SHA256分别相同：terminal `548aa8f8bfba4b9f1d086f428f64063a1787c973c67a9c211fbc6e037efc6331`；events `ce0a1cdad74d810a3a5063fed553a3016b886d3b90fc1433e0dc074402fa1748`；pulses `501967ee9b7134ee37eccca0fddae0da9cf637f0902d6b7a814b3101691c9d40`。

Herald 用原 `node scripts/verify-m8-herald-fixtures.cjs --write` 完整公共命令重录五份raw、manifest、trajectory。五支各14场/6088tick，全部raw导出后才加载生产restore；独立账本oracle及raw/start/15tick round-trip通过。新旧18场前缀+70场分支的普通阶段命令、事件hash、tick、结算轨迹逐字节相等（去除含身份的state/raw hash），轨迹SHA256同为 `4b3b2f98f0467cf94ae3ab9876b25cb500af8e56a105de3fa9f125dcb3f09075`。五支完整raw/start/前15次step在四项明确身份替换后逐字节一致，由真实旧/新代码分别restore并执行。比对脚本写入后另以只读模式复核通过。完整前后hash、字节长度和计数见 [fixture-migration.json](docs/evidence/p3p4p5/fixture-migration.json)，复现步骤见 [FIXTURE_MIGRATION.md](docs/evidence/p3p4p5/FIXTURE_MIGRATION.md)。

`grep -rlE "rules-gap-v1|bd9c3a8e" tests/` 最终命中4文件，逐文件保留原因：

- `tests/fixtures/m5/full-match-golden.t13.json`：T13历史公共路线golden原件，保留旧身份与原SHA，供新发布轨迹等价核验。
- `tests/t13-golden.test.ts`：显式断言历史T13 golden的旧digest和当前digest不同，验证历史原件未被重写。
- `tests/p3p4p5-content-baseline.json`：当前基线的previousContentDigest保留旧digest，用于发布身份追溯与旧身份拒绝验证。
- `tests/t13-content-baseline.json`：T13历史身份与首战events/RNG指纹基线，供本包独立对照，不能改成当前身份。
