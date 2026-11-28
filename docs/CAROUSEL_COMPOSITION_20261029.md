# 选秀英雄固定构成交付（2026-10-29）

## 【完成】

原始实现基线：`claude/v26-carousel-composition`，HEAD `4baaaf5a9a74335d46fa0e037a93e4e595f05384`，开工工作区干净；未写 Git、未提交。依据用户 2026-10-29 10:55 批准的构成表，以及 `/home/aiapps/workspcae/codex-briefs/reports-1029/carocost.md` 的现状审计。本次不自行补充历史概率；后期表明确按用户指定采用 S13 Evolved。

| 文件／入口 | 交付内容 |
| --- | --- |
| `src/simulation/carousel-policy.ts:3` | revision 升为 `v26-fixed-costs-1`；`CAROUSEL_COST_POLICY` 固定每盘费用张数、阶段 6/7/8+ 的六费组 2000/5000/10000 Bps、27 词语义与回退范围。`CAROUSEL_COST_ODDS` 保留为旧导出名称的兼容别名，不再是按槽基点表。 |
| `src/simulation/carousel-policy.ts:27` | `carouselCostCounts(stage,groupWord)` 返回只读费用 1–6 张数；非法 stage/uint32 参数抛 `invalid-carousel-composition`，无 RNG 副作用。 |
| `src/simulation/carousel.ts:94` | 固定名额无放回排列；同费按当前剩余份数、排序后的原英雄目录抽取并扣减；装备使用原来的词、目录和分类。恢复仍重算全部英雄和装备。 |
| `scripts/content-digest.ts:60` | 摘要根改为覆盖固定构成政策；未改摘要生成常量。 |
| `tests/carousel-composition.test.ts:48` | 独立批准表 oracle，多 seed 精确构成、1 星、装备词、27 词终态、池守恒、重复生成、JSON 恢复和合法总量下篡改拒绝。 |
| `tests/carousel-composition.test.ts:110` | 缺费的最近费用／同距低费优先、实际扣卡、六费不足回五费、仅余六费仍可生成和恢复。 |
| `tests/p7-carousel.test.ts:165`、`tests/server/carousel-room.test.ts:141` | 更新被取代的旧费用断言并增加联机生成／投影的精确构成和 1 星断言。 |
| `tests/augment-pool-batch5-h8-health-room.test.ts:15`、`tests/augment-pool-batch5-h12-max-cap-online.test.ts:11`、`tests/server/batch5-r6-recombobulator-room.test.ts:85` | 审查后修复三个确定性路线夹具；治疗与 Max Cap 换固定 seed，重组器保留 seed 并用真实购买／部署建立合星前提。原断言全部保留。 |
| `docs/S13_RULES_GAP.md:981`、`docs/MATCH_CONTRACT.md:959` | 替换旧概率合同，记录组概率、失败行为、兼容导出与纪元待录边界。 |

### 确定性与缺卡

每次创建仍推进原选秀 `lcg32-v1` 流 **27 词**：槽 i 的费用／英雄／装备仍占 `3i/3i+1/3i+2`。先读出这 27 词，以索引 24（末槽费用词）决定后期普通／六费组，再用各费用词按剩余名额排列。末槽只剩一份名额，其词值不影响费用选择，因此不另消耗判组或洗牌随机词。所有英雄词、装备词和生成后的 RNG 状态与旧消费位置相同；没有新增随机源或改变其他流的消费。英雄构成变化会改变抽到的英雄、自动选取、后续库存及战斗轨迹，不能据此承诺整局结果不变。

每槽先消耗目标费用名额，再以实际库存找最近的有货费用；同距离先低费。1–5 费既有回退排序和同费加权抽取保留，搜索范围扩至 1–6；六费只读已有 `SHOP_CATALOG_BY_COST[6]=mel/viktor/warwick`，共享池每个预留仍占一张。例：仅剩 1/3 费时，2-4 的四张二费均回一费；六费组没有六费时，其两张六费回五费。极端仅余六费的普通组也会因回退偏离固定构成；可用总数不足九张仍原子返回 `pool-exhausted`，原 pool/rng 引用、资源和事件保持不变。

所有生成棋子以 1 星展示／领取；之后原有下一准备期合星不变。装备仍是 2-4/3-4/4-4 普通散件，5-4/6-4 普通成装，每槽一件；同 seed 的装备结果逐槽保持一致。稀有全二费／全三费等组合未实现。

### 多 seed 实测

公共 `createCarousel`：每轮 1,000 个输入编号 0–999，每次从同一合法足额共享池起点生成；池 seed=42，一席通过 `createCarouselMatch`、`initializeSharedSeat`、`prepareCarouselParticipants` 初始化，naturalRound 设置为对应 catalog ordinal。选秀实际 RNG state 为 `(Math.imul(seed,0x9e3779b9)^0x4341524f)>>>0`。这是生成器统计，非 1,000 局完整对战。每盘都逐项断言构成；不是只检查汇总比例。每轮前十个输入还逐项验证重调、JSON 恢复和正式落位的 1 星。

| 轮次 | 盘数 | 1费累计 | 2费累计 | 3费累计 | 4费累计 | 5费累计 | 6费累计 | 普通组／六费组 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2-4 | 1000 | 1000 | 4000 | 4000 | 0 | 0 | 0 | 固定 1/4/4 |
| 3-4 | 1000 | 1000 | 3000 | 3000 | 2000 | 0 | 0 | 固定 1/3/3/2 |
| 4-4 | 1000 | 1000 | 2000 | 2000 | 2000 | 2000 | 0 | 固定 1/2/2/2/2 |
| 5-4 | 1000 | 0 | 0 | 3000 | 3000 | 3000 | 0 | 固定 3/3/3 |
| 6-4 | 1000 | 1000 | 1614 | 2000 | 2000 | 2000 | 386 | 807／193 |

上述 45,000 槽逐槽核对装备词、9 槽 1 星展示、27 词终态和池守恒。独立阶段政策再使用 10,000 个 seed（沿同一推导、取第 25 词）：

| 阶段 | 政策调用数 | 普通组 | 六费组 | 实测六费组占比 | 设定概率 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 6 | 10000 | 7938 | 2062 | 20.62% | 20% |
| 7 | 10000 | 4921 | 5079 | 50.79% | 50% |
| 8 | 10000 | 0 | 10000 | 100% | 100% |
| 9、20（各） | 10000 | 0 | 10000 | 100% | 100% |

概率边界额外检查 `ceil(Bps*2^32/10000)-1`、下一词、0 和 uint32 最大值；不以抽样频率代替精确边界断言。现有日程仅到 6-4，6-7 后是 PvP 加时；7/8+ 是纯政策测试，不伪称生成了可玩 7-4/8-4，也不新增这些回合。

### 全部运行时调用点（只读审计，未改服务器或界面）

| 模式／层 | 调用链和生效情况 |
| --- | --- |
| 唯一运行时生成调用 | `src/server/room/room.ts:913` 的 `openCarousel` → `prepareCarouselParticipants` → `createCarousel`；生成逻辑及恢复重算唯一在 `src/simulation/carousel.ts:94`。 |
| 联机 | `src/server/main.ts:113` 默认启用 `CAROUSEL_RULES_BINDING` → `src/server/room/carousel.ts:30` → `src/server-entry/index.ts:71` 的领域公共导出 → Room 入轮／创建。`CAT_CAROUSEL=0` 保留旧补给分支。 |
| 本地八人房间 | `src/rendering/online/local-room-client.ts:75` 默认绑定同一个 `CAROUSEL_RULES_BINDING`，因此使用同一生成器；`carousel=false`／`?carousel=0` 仍关闭选秀。 |
| 旧单机 | `src/m6/application.ts:224`、`src/rendering/match-session.ts:42` 调用 `createMatch`，没有共享选秀生成调用，继续组件补给。`createCarouselMatch` 本身只建立 shared-deferred Match 与选秀元数据，不另生成九槽。 |
| bot／接管／断线／超时 | `src/server/room/room.ts:945` 的 `catchUpCarousel` 调用 `autoPickCarouselForSeat` → 原“升级优先／费用降序／slot 升序”选择；不生成第二盘、不消耗随机词，人工和机器人共享同一盘。 |
| 2D | `src/server/room/projection.ts:135` 的 `toCarouselView` 调 `listCarouselSlots` → `src/rendering/online/online-application.ts:353` → `src/rendering/online/carousel-panel.ts:239`。只读 definitionId、1 星和装备，用既有英雄身份取费用；点击返回同一 Room 命令。 |
| 3D | `src/rendering/online/online-application.ts:367` 将同一 CarouselView 发布到 `src/rendering/board-feed.ts:204` → `src/rendering/three-mode/placeholder-renderer.ts:1153` → `src/rendering/three-mode/carousel-stage.ts:180`。点击从 placeholder-renderer:1327 经现有 controls 回 panel，不抽英雄、不扣库存。 |
| 恢复与附加领取 | `restoreCarousel`／`validateCarousel` 重算原九槽；`restoreCarouselSeat` 认证席位；`grantAdditionalCarouselPick` 从剩余槽领取，强化不另造一套费用生成。 |

## 【替换的断言】

1. `tests/p7-carousel.test.ts:165`：旧 `[1,2].toContain(sample.cost)` 由 2-4 旧费用池决定，替换为 `[1,2,3]`，并**增加整盘精确 `[1,4,4]`**；“升级优先于费用、slot 稳定、非法领取不推进 RNG”的既有断言全部保留。
2. `tests/server/carousel-room.test.ts:60`、`:112`、`:182`、`:225`：旧 `PAIR_TARGETS=nocturne/urgot/rell/renata` 和 seed=5 是旧按槽概率下的路线夹具；改为既有二费目录与 seed=6，仍按原商店脚本通过真实命令购买对子，不在运行时扫描 seed。s0 选择不占 s1 对子的空槽，s2 的临时位搬入用例选择不会立即合星的槽。这样继续分别检验“保持 1 星搬入”与“真实第三张下一准备期合星”，没有删除或放宽旧断言。错误信息补全现有阵容；额外增加联机 `[1,4,4,0,0,0]` 及投影九个 1 星断言。
3. 原合同 §11.2 的五行每槽概率（2-4=20/80，3-4=20/80，4-4=20/80，5-4=70/30，6-4=全五费）逐行被上方固定张数／组概率表覆盖；新增五轮各 1,000 seed 的逐盘精确断言。没有保留旧概率来伪装通过，也没有删除旧确定性、资源原子性、池守恒或恢复断言。
4. `tests/augment-pool-batch5-h13-carousel-room.test.ts:68`：旧伪造固定把第一条变换输出设成 `sword`；新路线该输出本来就是 `sword`，不能再把无修改当伪造。改为原值是 sword 就改 tear，否则改 sword，并增加 `bad != original` 断言；两种恢复入口、对象／JSON 的全部拒绝断言保留。

5. `tests/augment-pool-batch5-h8-health-room.test.ts:15`：原 seed=15 在新选秀路线下，3-2 初始三选及每槽一次刷新均未向任何席位提供 `dhampyr`，所以 `ids.length > 0` 首先失败，随后依赖 `healedMatch` 的治疗／认证断言连锁失败。改为固定 seed=10（旧注释对 seed=10 的判断只适用于旧选秀）；真实 Room 的受伤赢家能够获得强化并造成足量实际玩家伤害。保留全部 16 项测试：真实伤害的 20% 取整治疗与上限、12% 全能吸血账本、对象／JSON／canonical 认证及篡改拒绝、镜像与过量伤害、幂等、下一 PvP 和选秀恢复边界；未脚本化强化抽取，未增加刷新次数。
6. `tests/augment-pool-batch5-h12-max-cap-online.test.ts:12`：原 seed=4 在新英雄／库存／战斗路线下，4-2 所有人类席位三槽各刷新一次仍无 `max-cap`，因此获取前置条件失败，三个用例无法执行。改为固定 seed=6，并同步失败提示。保留真实随机三选和原刷新次数；仍断言选择前可购买 XP、获取后精确 60 金币与唯一权杖、7 级上限／清零 XP、原 state 的 `max-level` 拒绝、池守恒、三种表示认证／篡改拒绝、下一回合无 XP 和唯一收据。
7. `tests/server/batch5-r6-recombobulator-room.test.ts:85`：原 seed=9 的首个可选槽从旧路线的同名开局英雄变为 `vladimir`，开局棋盘为 `vex`，2-5 商店也没有 `vladimir`；原“已有同名棋盘单位且商店有第三张”前置条件不成立。保留 seed=9，路线改为领取固定构成中的一费槽（`powder`），在 2-5 通过真实刷新／购买先取得同名副本并部署上棋盘，再买第三张。原 `receipt.unitId` 存在、棋盘另有同名副本、第三张可买、合星必须消耗选秀 ID、二星幸存者在 3-2 变换、3-4 对象／JSON 恢复及全部篡改拒绝断言均保留；仅扩充路线前置操作，没有伪造领域状态。另一组“先变换再合星”路线完全未改。

### 验收结果与命令

首轮只选择了 **15 个测试文件，合计 261 项通过**：首轮 13 个文件 231 项通过；修复上述两个夹具后，定向重跑其完整文件 30 项通过。此范围并非全部 server／augment-pool room 回归，遗漏了审查指出的上述三个文件；不能据此宣称房间夹具已无其他漂移。本次补验结果与精确范围见下文。`npm run typecheck` 与 `git diff --check` 均通过。没有提高任何超时，没有给 `src/server` 增加计时 API。

当前环境的 `node_modules` 为只读挂载，默认 Vite 配置打包缓存写入失败；采用 `--configLoader runner`，临时配置 `artifacts/carousel-composition/vitest.config.ts` 继承原配置，仅把 cacheDir 指向 `/tmp/carocomp-carousel-vite-cache`、移除 fast 项目的全局浏览器启动钩子。所有测试仍使用原 setupFiles、断言、计时与 `--maxWorkers=4`，未运行需要浏览器的测试。

```sh
npm test -- \
  tests/carousel-composition.test.ts tests/p7-carousel.test.ts tests/p7-1-carousel-rules.test.ts \
  tests/server/carousel-room.test.ts tests/augment-history.test.ts tests/augment-history-carousel-growth.test.ts \
  tests/augment-pool-batch5-h5.test.ts tests/augment-pool-batch5-h5-priority.test.ts \
  tests/augment-pool-batch5-h13-carousel-room.test.ts tests/server/augment-pool-batch5-g7-carousel-restore.test.ts \
  tests/augment-pool-batch5-h7-health.test.ts tests/server/local-room-client.test.ts tests/server/bot-driver.test.ts \
  tests/rendering3d-carousel.test.ts tests/playtest-1022b-bench.test.ts \
  --config artifacts/carousel-composition/vitest.config.ts --configLoader runner --maxWorkers=4

# 两个修改后的夹具完整复验（30 项通过）
npm test -- tests/server/carousel-room.test.ts tests/augment-pool-batch5-h13-carousel-room.test.ts \
  --config artifacts/carousel-composition/vitest.config.ts --configLoader runner --maxWorkers=4
npm run typecheck
git diff --check
```

统计原输出为 `artifacts/carousel-composition/composition-test.log`；首轮与复验原报告为同目录 `regression.json`／`retry.json`，最终逐文件来源汇总为 `final-checks.json`（明确是两次运行的汇总，不是伪造的一次全绿报告）。`playtest-1022b-bench` 已执行，原 `bench-timing.json` 通过 finally 原样恢复，并以字节比较及 Git diff 复核，工作区无该文件变动。所有 artifacts 均不提交。

### 审查后补验（本次修订）

三个文件先以原夹具复现失败，再以修复后的完整文件定向复验：**3 文件、25 项通过**（H8 16、Max Cap 3、重组器 6），这些文件又包含在以下扩大快速回归中，不重复计算总量。

| 实际运行 | 文件数 | 通过项 | 失败项 | 精确范围 |
| --- | ---: | ---: | ---: | --- |
| 扩大 fast | 155 | 23964 | 0 | `tests/server/` 的 133 个 fast 文件，顶层名称含 room／online 的 19 个 augment-pool 文件，以及 carousel-composition、p7-carousel、p7-1-carousel-rules。 |
| 补充 fast | 14 | 412 | 0 | 另外 10 个直接引用 `server/room` 或 `server/helpers` 的顶层 augment-pool 文件；augment-history、augment-history-carousel-growth、rendering3d-carousel、playtest-1022b-bench。 |
| server timing | 5 | 983 | 1 | 原配置排除在 fast 外的 ws-client、g3-ops、local-room-client-full-match、round-commit-timing、bot-driver-timing；沿用 timing 的顺序执行配置。 |
| 仅隔离重跑失败用例 | 1 | 0 | 1 | bot-driver-timing 的八机器人用例；`-t` 过滤了另一个已在上行通过的用例，不以过滤结果覆盖它。 |

因此，**全部 169 个选定 fast 文件、24,376 项通过，未发现其他 seed 夹具漂移**。另行完成的 timing 不能宣称全绿：八机器人完整对局的玩法／命令／排名断言通过，最后的原有墙钟断言 `actualMs < 60000` 失败（首次 **66981.88 ms**，隔离复跑 **66340.54 ms**）；七机器人加闲置人类用例通过。`tests/server/bot-driver-helper.ts:20` 的 `botRoom` 未提供 carousel 绑定，`src/server/room/room.ts:874` 仅在提供绑定时进入选秀，故该失败没有经过本单改动的选秀生成器。保留该性能失败、原 60/120 秒上限、原墙钟断言及所有规则断言；未改为 report 模式，也未扩大超时。

完整覆盖清单已经核对：138 个 server 文件、29 个顶层 augment-pool 房间相关文件，以及上述 7 个规则／历史／3D／bench 文件，**共 174 个不同文件**。按用例合并证据为 **25,359 项通过、1 项时序失败，无缺失覆盖**；这是多次运行的来源汇总，不是一次全绿报告。计数包含仓库原有按回合／片段注册的持续对局测试，不代表同等数量的独立对局。原首轮 15 个文件全部包含在本次范围中；仍未运行全仓库其他 fast 文件或浏览器截图验收。

所有运行均使用 `--config artifacts/carousel-composition/vitest.config.ts --configLoader runner --maxWorkers=4`，沿用原 setupFiles、隔离、断言与超时。timing 直接选择原 `timing` 项目，不将其混入 fast。完整命令参数保存在 `review-room-fast-command.json`、`review-extra-fast-command.json`、`review-server-timing-command.json`；选中的原始文件清单为 `review-room-files.txt` 与 `review-extra-files.txt`，均位于 `artifacts/carousel-composition/`。可在本工作区重放这三个准确命令并自动恢复 bench：

```sh
python3 - <<'PY'
import json, subprocess
from pathlib import Path
out = Path('artifacts/carousel-composition')
bench = Path('docs/evidence/playtest-1022b/bench-timing.json')
original = bench.read_bytes()
for name in ['review-room-fast', 'review-extra-fast', 'review-server-timing']:
    try:
        result = subprocess.run(json.loads((out / (name + '-command.json')).read_text()))
        print(name, 'exit:', result.returncode)
    finally:
        if name == 'review-extra-fast':
            bench.write_bytes(original)
PY

# 只隔离复跑实际失败项；原 60 秒断言仍生效
node node_modules/vitest/vitest.mjs run --project timing tests/server/bot-driver-timing.test.ts \
  -t 'plays eight bots from the first round' \
  --config artifacts/carousel-composition/vitest.config.ts --configLoader runner --maxWorkers=4
```

原始报告分别为 `review-fixed.json`、`review-room-fast.json`、`review-extra-fast.json`、`review-server-timing.json`、`review-bot-timing-retry.json`；`review-final-checks.json` 保留每项最终证据的来源与初次／复跑统计，明确保留失败。初始失败复现及开发时固定 seed 筛选日志也保留在同目录，不算作修复后的验收结果。bench 再次执行后通过 finally 恢复，`review-bench-restore.json` 记录字节校验；与本次及原始备份均逐字节一致，Git diff 无变动。`npm run typecheck`、`git diff --check` 通过；只读 identity 检查仍如下一节预期报摘要陈旧。本次修订仅修改上述三个测试及本报告，未再改规则、服务器、身份常量或 golden，未执行 `--write`，未写 Git。

## 【需要重录】

只读 `node scripts/update-content-identities.cjs --check` 已确认：现存 CONTENT=`fnv1a32-utf16:f671ab88`，本候选根重算为 **`fnv1a32-utf16:d464891f`**；LOOT_REPLAY 仍为 `fnv1a32-utf16:36ebfac2`。因此 `--check` 预期报 Stale content identities，生成常量未写入。全局规则／内容版本仍是 v25；本分支仅升选秀 revision。Claude 应在汇总 v26 后统一更新版本／摘要和受影响纪元／golden，最终摘要以汇总后的重算为准；本单没有执行 `--write`，没有重录、删改或弱化任何历史身份断言。

## 【风险】

- 缺卡回退会改变实际费用构成；满库存精确表和缺卡边界必须分开解读。旧名称 `CAROUSEL_COST_ODDS` 的数据形状已变为固定构成政策，仓库无运行时读取其旧概率数组的调用方，外部调用方须按更新合同读取。
- 当前 7/8 阶段只有政策，没有实际选秀日程；本单遵守既有 6-7 后 PvP 加时决定。
- 候选摘要未落盘、纪元未录制前不得作为新旧兼容发布依据；旧选秀快照按新生成器恢复会因重算不同而拒绝，不做猜测迁移。
- 额外 server timing 的八机器人用例连续两次超过原 60 秒墙钟门槛；它未启用选秀，所有功能断言通过，但性能门禁仍未通过，不能将本次验收标记为全绿。
- 本单覆盖相关规则、server（含网络／时序）、强化房间、本地适配和 3D 逻辑测试；未进行桌面浏览器截图验收。不需要浏览器的逻辑测试使用临时配置移除全局浏览器启动钩子。
