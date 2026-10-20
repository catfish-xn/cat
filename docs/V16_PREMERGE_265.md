# #265 v16 下一轮收口（2026-10-20）

用户指定现场：`codex/epic-loot-reforger` 正在合并 `origin/codex/loot-orb-claim`。本轮未执行任何 Git 命令、未写 `.git`、未联网或安装依赖；未修改 `src/server/`、`src/rendering/`。工作区冲突标记已清除；索引和 MERGE_HEAD 仍留给协调者处理。

## 1. 合并冲突：14个文件

| 文件/组 | 保留内容与依据 |
| --- | --- |
| `src/presentation/ability-text.ts` | v16 四星数值查询与 v15 中文名称/模板组合，普通星级查询不变。 |
| `loot-view.ts`、`orb-loot.ts` | v16统一重铸器、两种复制器、史诗forge payload，结合v15客户端图标与fallback。 |
| `s13-g23-manifest.ts` | 同时保留D11、D14身份映射。 |
| `vite.config.ts` | 原样保留v16 productionIdentities/Phaser chunk方案，结合v15原stripAssetChecks；未扩展白名单或继续增加体积优化。 |
| `combat-first-pass-frames`、`g2-4b-artifacts` | 最新实时银行导出形状及v16 revision。 |
| `g2-4a-crown-history`、`helpers/g24-forge-states.ts` | v16工具身份与v15法球领取、共享不可变输入准备组合；不跳过领取/恢复。 |
| `m8-b8-live-capacity/live-transfer/loot-view` | 保留v15既有20秒时限与授权注释，重新核实真实路线、奖励、身份和账本。 |
| `t12-combat-equip` | 保留v15 beforeAll/copyInput；真实路线到4-4验证选择与恢复。 |
| `task-mechanism-restore` | 保留真实触发的v15位置/强化；弗拉基米尔按定义与阵营定位，仍验证castCount及篡改拒绝。 |

测试侧9个冲突文件中，8个测试文件逐文件通过，1个helper由冠冕等真实路线覆盖。法球领取、按卡刷新、终局作废、D11显示、侦察显示和20秒既有时限随最新base保留，未另改这些规则。

## 2. 方案A：复制器独立流

生产实现 `orb-bonuses.ts::orbDuplicatorIndex`，在该珠**全部原内容抽完后**调用，结果只追加末尾entry。

1. `text = JSON.stringify(['orb-duplicator-v16', seatMatchSeed, orbId])`。
2. FNV-1a UTF-16：`h=2166136261`，逐个code unit执行 `h=imul(h XOR codeUnit,16777619)>>>0`，无额外XOR salt。
3. h作为全新lcg32-v1初态、draws=0，每词 `(1664525*state+1013904223) mod 2^32`；拒绝 `word >= floor(2^32/100)*100`，首个合法词 `%100`。
4. 每珠独立重建，仅1–4阶段非棱彩执行。原loot/layout/shop/choice等流均不推进，恢复重建相同追加结果。

派生元数据进入ORB_RULES/digest；合同已更新：[M8B_LOOT §11](M8B_LOOT.md)、[MATCH_CONTRACT v16](MATCH_CONTRACT.md)。

史诗oracle以独立BigInt FNV/LCG核对4,096种子的全部payload、身份、顺序、游标。M5 `oracle.g2.cjs::lootPlan`按冻结表独立重写，不再调用史诗测试oracle，两份oracle在4,096种子上一致，均不导入生产实现。

另实际加载本地保留的v15源码冻结器，比对4,102种子至4-7：去除追加复制器、仅把两个旧重铸器名称映射为已批准的reforger后，**原payload/身份/顺序和主RNG全部相同**。见[原流证据](evidence/v16/premerge-265-legacy-loot.json)。未重新核验该本地归档的提交来源。

MatchSession恢复Lux、Irelia、cloak断言，18项通过。独立算术证明seed7216/6240原1-3均为Lux；第二条为保留用户指定Irelia断言，改用真实seed6160，不伪造6240结果。浏览器seed14349原Lux、弓、棒及羊刀战斗/攻速链均保持原值并通过。

## 3. 四星售价

删除 `D14_POLICY.ultimateSellGold`，文档改为“与该英雄三星同价”。两处私有sellGold投影直接调用 `getUnitSellPrice({definitionId,starLevel:3})`；原出售命令本来就按物理三星调用此函数，继续使用唯一公式。

新增 `d14-sale-price.test.ts`：一费Lux有效四星9金、二费Rell有效四星17金，同时核对单位行、d14Display、真实三星出售差额与9份投影。二费是售价投影边界向量，不扩大终极英雄仅一费的目标准入。退池9份不变。

## 4. 五个红项及真实路线

| 项 | 合并/方案A后的结果与依据 |
| --- | --- |
| crown-history | 56项通过，整文件约30秒；保留v15共享准备优化，未新增时限放宽。 |
| m5-growth | 2项通过；seed8真实资源路线恢复，不再撞异常选择，未削减成长断言。 |
| opening-random-1cost | 4项通过；seed42仍是Irelia，原奖励流/游标恢复。 |
| augment-tier-consistency | 领域7项、服务器2项通过。三张各一次，所以节点初始剩余3、刷一张后2；augmentRerollLimit=1指单卡。base已包含正确实现/期望。 |
| g2-2-emissary-wins | 服务器2项通过。base后排Ambessa已隔离lineup前排防御修正；仅报告，未改服务器及其测试。 |

其他严格向量：capacity seed36为18金、reveal117/final137；transfer seed18619真实触发两张付费Ezreal、slime-time、窃贼手套与奖励合星，19项通过；终局seed38末尾新增次级复制器，精确校验5条状态、4张领取收据，不截掉奖励。进入未知在恢复原流后首空位为bench0，改为严格断言0。

live-reveal恢复v15原种子242874/139464/3464与原补给；tick44的eventSeq382/383、Loris381、Zyra152和4/0收据原断言通过，没有放宽为区间。

额外M5路线：独立表证明seed42两次均为standard史诗变体，严格期望为2锻造器，8原组件+5补给+4锻造等价=17。四份seed42完整golden仍逐项比较；Caitlyn至少两战施法/伤害另由真实付费seed44路线验证（4场、6次施法），保留原次数下界。

本轮未新增超时放宽；既有用户批准的20秒/长重放时限保持。

## 5. 最终v16 epoch

最终源码按release → Herald → inputs → live-reveal完成录制。四条release路线各33战；cannon/sniper各67状态均验证文本/对象恢复、再次序列化字节。Herald五份输入在导入恢复器前先导出raw，再验证原状态及开战后15tick恢复。inputs/live-reveal的`--check`均通过。

| 身份 | 上轮v16录制值 | 本轮最终值 |
| --- | --- | --- |
| CONTENT_DIGEST | `fnv1a32-utf16:f8a31ce9` | `fnv1a32-utf16:de829c8a` |
| LOOT_REPLAY_DIGEST | `fnv1a32-utf16:cee1d7d7` | `fnv1a32-utf16:62c76cb9` |
| RULES_GAP_MANIFEST | `fnv1a32-utf16:81596be6` | `fnv1a32-utf16:31950a0f` |

保留v15 baseline为CONTENT `70dbb056`、LOOT `61568ec0`。规则/内容仍v16；无迁移、兼容别名或历史目录重写。209份历史文件与本轮开始时SHA-256快照相同。

因用户禁止Git，录制器新增显式 `V16_HISTORY_SNAPSHOT` 模式，从本轮固定哈希的本地历史文件读取；只证明本轮历史未变，**不冒充重新核验提交出处**。普通Git归档模式保留。详见[机器记录](evidence/v16/premerge-265-verification.json)。

## 6. 构建与体积

`npm.cmd run build -- --configLoader runner`通过（含tsc）。runner绕过共享node_modules联接下默认esbuild配置加载权限错误，不改变构建目标。生产裁表等价再次通过9项目录/身份及seed42/7216/6240首战状态/事件比较。

m7-budget口径：全部 `dist/assets/*.js`逐文件gzip level9求和，Phaser chunk计入。基线为此前本地保留15313a7产物，本轮不通过Git重建或核验出处。

| 项 | 测量 |
| --- | ---: |
| 基线gzip | 424,763 B |
| 本轮gzip | 618,719 B |
| 比值 | **1.4566216926 ≤ 1.49** |
| 首次交互中位数（各3样本） | 基线566 ms / 当前619 ms，1.09364倍 |

原1.50预算配置未改；另确认满足用户1.49要求。裁表方案仍在既有评审中，通过预算不替代评审。

## 7. 验证、复现与交接

要求范围逐文件27份/635项通过，含两个服务器文件及全部8个冲突测试文件，另覆盖冲突helper；额外M5路线8项及sniper/mage/sniper-caitlyn逐命令、逐tick完整恢复重放3项通过，合计**31文件/646项**。tsc/build、生产投影等价、原流4,102种子、两份独立oracle、epoch录制/输入校验、历史哈希、浏览器38场景均通过。机器记录列明每份结果与哈希；未宣称全仓库或服务器房间整体验收。

浏览器约430行Lux/弓/棒原断言保留。`b6-public-preparation.cjs`在结算Continue前补与Start相同的450ms等待：空棋盘立即结束，截图提示“阶段刚切换”，过快点击会持续触发现有保护。只用真实原生输入，不注入资源、不加速战斗、不改界面。38场景、0跳过通过；增加 `M5_NO_GIT=1` 与可选runner，保留源码指纹。

PowerShell复现（先build，使用本机Chrome，无下载）：

```powershell
$env:M5_NO_GIT='1'
$env:VITE_CONFIG_LOADER='runner'
$env:CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
node scripts/verify-m5-input.cjs --preview
```

建议提交：`fix(v16): merge v15 closeout, isolate orb bonus RNG and use three-star sale prices`。

未暂存、提交或结束合并，这是用户要求保留的现场。协调者继续既有裁表评审并处理索引/提交；无需新的玩法决定。
