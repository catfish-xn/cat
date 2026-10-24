# 增幅池续批报告（v23 candidate，2026-10-24）

基线 `codex/augment-pool-batch1` / `700a5e107256dd2f5269121deca5f1b8bf1a8ef9`；仅工作树改动，不提交、不重录。本文是详细报告；最终答复供调用方 `-o` 保存。

来源：`/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json` 的同名 apiName、`selection-augment-fields.json` 与 `map22-augment-item-nodes.json`；原始下载URL为 [CDragon 14.24 en_us](https://raw.communitydragon.org/14.24/cdragon/tft/en_us.json)、[zh_cn](https://raw.communitydragon.org/14.24/cdragon/tft/zh_cn.json)、[map22](https://raw.communitydragon.org/14.24/game/data/maps/shipping/map22/map22.bin.json)。本次使用已归档节选，没有重新下载或改写证据。14.24客户端目录不自动等价于14.24b服务端行为。

## 已决三项

- **P 2026-10-24：随机纹章**采用现有22个 `EMBLEM_ITEMS` 等权排序池。开放 `TFT_Augment_BranchingOut`（`branching-out`）：一随机纹章、一重铸器，沿用独立 seat/choice/spec LCG 流与唯一收据。batch 1合计由64/69变67/69（另两项见下条）。
- **P 2026-10-24：锅铲厨房**采用解析描述 Cape+随机纹章，不能把散落的铲/锅/锻造器常量当成额外奖励。增幅包与黑市节选不足，但仓库保留的 `src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz`、`en_us.json.gz`、中英文stringtable给出完整物品依据：`TFT_Item_TacticiansRing`=Cape、`TFT_Item_TacticiansScepter`=Shield；均 `MaxArmySizeIncrease=1, PercentGoldChance=10`，Cape另有 `Timer=10`。Shield持有者实际死亡时10%掉1金；Cape持有者存活到第200tick结束时10%掉1金，每战一次；配方为锅+锅、铲+锅。已实现物品、两个配方、人口与所有成功/失败抽取收据；人口沿用项目既有冠冕取得后永久+1政策。物品金币共用现有独立于战斗主RNG的collector物品流（实现约定），失败结果同样持久化。`TFT_Augment_TacticiansKitchen`、`TFT_Augment_Coronation`均已开放；后者每件Crown/Shield/Cape给携带者30%AD/30%AS/40AP。
- **P 2026-10-24：闪若金鳞**必须同时认证生金神器池和InterestCap语义。`TFT9_Augment_AllThatShimmers`、`TFT_Augment_AllThatShimmersPlus`仅确认 `ArmoryChoiceCount=3`、拆卸器、Plus `GoldGranted=4`、孤立常量 `InterestCap=5`；增幅归档及仓库保留map22同名节点均无该强化→完整神器候选列表/权重的绑定，也无InterestCap是否修改玩家利息/仅物品计算/遗留常量的调用证据，继续禁用。不能由“现有哪些物品会生金”反推合法池。

## batch 2：严格取classification.json中batch="2"的26项

17项已入池，9项禁用。所有26项的原始effects（含未解释哈希）、中英文解析描述、traits、等级与状态均保存于 `content/augment-pool-batch2.ts`；禁用项只做研究清单，不发部分奖励，也不出牌。

| apiName | 内部id | 状态 | 14.24具名值 |
| --- | --- | --- | --- |
| `TFT13_Augment_Academy` | `academic-research` | 阻塞 | NumItems=1.0, NumOptions=2.0 |
| `TFT13_Augment_Ambusher` | `loot-explosion` | 阻塞 | 描述给定，无具名数值 |
| `TFT13_Augment_Artillerist` | `rocket-collection` | 完成 | IncreasedRocketDamage=0.15000000596046448, MaxItems=2, RocketDamageThreshold=75.0 |
| `TFT13_Augment_ArtilleristPlus` | `rocket-collection-plus` | 完成 | IncreasedRocketDamage=0.15000000596046448, MaxItems=2, RocketDamageThreshold=65.0 |
| `TFT13_Augment_Automata` | `fractured-crystals` | 完成 | Percentage=0.699999988079071 |
| `TFT13_Augment_Bruiser` | `heavy-hitters` | 完成 | RefreshSeconds=4.0, SlamPercentHealth=0.07000000029802322 |
| `TFT13_Augment_Cabal` | `forbidden-magic` | 阻塞 | NumTakedownsPerStack=3.0, SionADPercentPerStack=0.014999999664723873, SionHealthPerStack=10.0 |
| `TFT13_Augment_Chembaron` | `crimson-pact` | 完成 | Gold=6.0, Heal=4.0 |
| `TFT13_Augment_Conqueror` | `noxian-guillotine` | 完成 | ArmorandMagicResist=5.0, BaseExecuteThreshold=12.0, NumKills=1.0 |
| `TFT13_Augment_Dominator` | `dominate` | 完成 | ShieldAmount=100.0, ShieldDuration=3, ShieldPercentAS=0.10000000149011612 |
| `TFT13_Augment_Enforcer` | `enforce` | 完成 | BonusAD=0.10000000149011612, BonusGoldAmount=6.0, WantedEnemyBreakpoint=6.0 |
| `TFT13_Augment_Experiment` | `natural-selection` | 阻塞 | Health=0.11999999731779099 |
| `TFT13_Augment_Family` | `welcome-to-the-playground` | 完成 | MinNumFamilyMembers=2.0, NumCopies=1.0, TimeRequirement=17.0 |
| `TFT13_Augment_Firelight` | `aerial-warfare` | 阻塞 | Bonus=3.0, FirelightBonusAD=0.09000000357627869, FirelightBonusAP=9.0 |
| `TFT13_Augment_Formswapper` | `why-not-both` | 完成 | BonusStats=24.0 |
| `TFT13_Augment_PitFighter` | `pit-fighter-prizefighter` | 完成 | ADPerLoss=0.014999999664723873, HealthPerWin=45.0 |
| `TFT13_Augment_Quickstriker` | `quickstriker-boost` | 完成 | AttackSpeed=0.8500000238418579, BuffDuration=2.5, TimeBetweenProcs=6.0 |
| `TFT13_Augment_Rebel` | `rebel-resurgence` | 阻塞 | NumOfUnits=5.0, ReducedHealth=400 |
| `TFT13_Augment_Scrap` | `scrap-recycling` | 完成 | MaxComponents=5.0, NumScrapItemsConverted=6.0 |
| `TFT13_Augment_Sentinel` | `sentinel-slam` | 完成 | Interval=4.0, PercGain=0.05000000074505806, ResistToDamageRatio=0.75 |
| `TFT13_Augment_Sniper` | `snipers-nest` | 阻塞 | DamageAmp=8.0, MaxAmp=32.0 |
| `TFT13_Augment_Sorcerer` | `sorcerer-explosion` | 完成 | DeathPercentage=3.0 |
| `TFT13_Augment_Visionary` | `visionary-voidlings` | 阻塞 | Mana=275.0, MaxVoidlings=5.0, Stage2Health=400.0, Stage3Health=450.0, Stage4Health=500.0, Stage5Health=550.0, Stage6Health=600.0 |
| `TFT13_Augment_Watcher` | `watcher-growth` | 完成 | IncreaseADByTakeAttack=2.0, IncreaseAPByTakeSpell=4.0 |
| `TFT13_TeamupAugment_Betrayal` | `betrayal` | 完成 | NumKills=2.0 |
| `TFT13_TeamupAugment_BloodBrothers` | `blood-brothers` | 完成（2026-10-24 wave4，P-AG5） | APGainPerDeath=6.0, MaxHealthGainPerCast=30.0 |

## 2026-10-24 独立审查续修

S1/S2/N1与本次逐项复核、最新测试见 [续修报告](AUGMENT_POOL_REVIEW_FOLLOWUP_REPORT.md)。历史测试小节保留此前结果，最新结果以续修报告为准。

- 新完成 `why-not-both`：研究JSON零基记录[215]，24AP/双抗/24%AD、初始Swain/Gangplank与升三星给二星复制均有源；新增有序选择标记与事件序号认证，排除同轮选择前的升星。奖励沿既有容量/共享池与唯一收据，可连锁合星，不新增RNG。
- 其余9项逐项重查研究JSON、selection字段和map22同名节点，缺字段未补齐，继续完整禁用；不以P擅自填未知值。

## 已交付行为与验收边界

- 8项战斗行为：第二道海克斯震波70%；格斗家每4秒下一击7%HP；征服者严格低于12%处决并每次+5双抗；统领有盾+10%AS、击杀给成员100盾3秒；迅击开场/每6秒+85%AS持续2.5秒；哨兵+5%双抗且每4秒下一击75%总双抗魔伤；法师死亡对所有邻格单位（包括友方，双语原文均为all units）造成300%AP魔伤；监察每普攻命中+2%AD、每技能伤害命中+4AP。
- 火箭收藏/Plus：火箭每发增伤15%，跨战累计75/65枚，最多两件收集者；执法：成员+10%AD，六名通缉敌人首次死亡给6金；极客每六次实际组件转换给随机组件，最多五件。
- 游乐场：17秒tick伤害与死亡结算后或提前终局时至少两家人存活，每场一次，在结算生成固定Vander/Powder/Violet池的随机复制；背叛：Maddie的普通攻击/技能跟随存活Ambessa当前目标，任一伙伴单独达到两次击杀才给一Maddie，不合并二者击杀数。
- 搏击手：取得后每战胜利累积45HP、失败累积150AD Bps、平局不增长，按阵营共享的增幅历史派生，应用给当前成员；不修改Tristana专属persistentGrowth。底城争夺战：每次成功保留微光立即回4HP（封顶100）与6金，超时保留走同一回调；恢复按准备期/战后两段收据恢复治疗顺序。
- 通用：原Match签名与失败reason保持；新事实字段 `G23BattleFacts.batch2` 来自权威战斗，金钱/物品/英雄奖励从该账本重建并用唯一收据发放；英雄沿用单人容量待发、联机奖励法球/共享池；无新增网络或UI发奖入口。增强单位效果含纹章成员，不要求羁绊已激活；出牌依现有2-1不定制、3-2/4-2场上快照、静态互斥，以及Family跨玩家互斥/Chembaron每局仅向一席提供。

## 阻塞与缺字段

- `TFT13_Augment_Academy`：源值 NumOptions=2、NumItems=1 齐；缺赞助装备在三件 sponsor 中的选项抽样/权重及“所合成装备本身已是赞助装”时的去重与补位规则。现有通用四选锻造器不能冒充本项二选定制锻造器。
- `TFT13_Augment_Ambusher`：缺暴击率→掉落概率公式、战利品奖励表/权重及战利品暴击的倍率/递归上限；不是只有一个待填掉落率。
- `TFT13_Augment_Cabal`：三名黑玫瑰弈子的具体候选/费用/抽样权重未给出；还缺跨战 Sion takedown→永久成长的独立认证接线。现有 g23-sion 已存在，不能沿用旧分类“没有 Sion”的过时原因。
- `TFT13_Augment_Experiment`：只有 Health=0.12；缺新增牺牲实验格的位置/选取规则、无合法格/空格处理，以及牺牲来源加成的传播目标规则。
- `TFT13_Augment_Firelight`：9%AD/9AP 与 Bonus=3 齐；缺“每格另外3%”作用于基础值还是累积值的精确定义，以及该战移动格数是否含普通移动/冲刺/传送、冲刺过程如何计格。
- `TFT13_Augment_Rebel`：5名/减400HP齐；缺一星死亡后的目标星级（原文低一星）、最低生命下限及召唤复制继承装备/永久成长/强化、是否能再触发复制的完整口径。
- `TFT13_Augment_Sniper`：每次8%、上限32%齐；缺首战是否即有一层、换格/备战席/离场/重新购买时的层数重置规则及合星继承规则。
- `TFT13_Augment_Visionary`：275法力、最多5只、阶段2–6生命400/450/500/550/600齐；缺虚灵基础AD/攻速/双抗/射程/技能与出生位置/无空格政策，不能只造一个有HP但其余数值自定的单位。
- `TFT13_TeamupAugment_BloodBrothers`：已于2026-10-24 wave4开启。原缺的多副本配对、死亡/复活/出售/合星成长归属按 `S13_RULES_GAP.md` P-AG5（next-version-data-check 推荐约定）补齐；跨战累计用战斗事实 `blood-brothers`/`blood-brothers-deaths` 认证。

## 后续规则问题与建议（均未擅自设为P）

- 学术研究的赞助选项：建议先补来源中候选池、权重和重复时行为；若接受项目政策，可在当局三赞助装中等权选一件、排除合成装并去重，仍需另行确认。
- 禁忌魔法三弈子：建议补原版候选/费用/权重；若改为项目政策，建议明确列出已有Black Rose成员池并沿用通用等权、共享池奖励规则。
- 空战每格3%：建议取得脚本/历史释义确认加法还是乘法与移动计格，不把Bonus=3自行绑定到AD/AP或距离。
- 试验品特殊格、一星蓝发复制、狙神层数重置、虚灵完整属性：建议继续禁用直到补齐上节字段，避免选择一个未经批准的坐标、下限或单位数值。
- 本可发生之事：已按 P-AG5 开启（多副本取获得最早者；累计值属于玩家），属项目约定，不伪称14.24事实。

## 测试与结果

- 最终增幅定向回归：**20文件、658/658通过**（`npm test -- --configLoader runner --cache=false --maxWorkers=2` 后显式列出20个增幅相关文件）。没有执行全套、浏览器测试、录制或部署。
- 本轮新增3个测试文件：`augment-pool-batch2.test.ts`、`augment-pool-batch2-progress.test.ts`、`augment-pool-tactician-items.test.ts`，共87项；另有batch 1逐项测试自动覆盖新增三项。覆盖26项清单/禁用边界、成员与纹章、数值/时间边界、周期消费、处决/盾/死亡爆炸、火箭/通缉/转换跨战计数与上限、17秒及终局家人资格、伙伴独立击杀、永久胜败成长、黑市HP时序、物品成功/失败抽取、人口/配方、Coronation实时换装、公共选择/结算/恢复、篡改拒绝和重复命令不重发。
- **typecheck通过**；`git diff --check`通过；Git仍在`codex/augment-pool-batch1`、HEAD仍为`700a5e107256dd2f5269121deca5f1b8bf1a8ef9`；禁区变更0，未提交。
- 首次测试启动因共享只读node_modules不能写`.vite-temp`失败，改用runner加载与关闭测试缓存后正常运行；没有改node_modules或构建配置。扩池后只更新可执行独立oracle的池ID/过滤字面表及旧测试的出牌数量/固定种子（7329、6672），保留原来的统计/护盾断言，未重录任何golden或修改v21/v22 fixture。

## 风险

仍是v23候选：manifest包含新内容与禁用原因，但按用户限制未改identity-constants.ts或m8/version.ts；当前身份不可用于正式新旧混跑。未触碰docs/evidence、v21/v22 fixtures、录制脚本或v22在线规则脚本。仅增幅相关测试与新增测试；没有运行全套。
