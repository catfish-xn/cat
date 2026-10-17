# 原测试 → 入档边界 → 真实下游覆盖

所有行号对应受测代码1b72395；最终补充若有见REPORT。`B拒`指object restore、JSON restore、serialize具体拒因`preparation-ledger-command-rejected`，不是skip。人为变坏状态若更早校验拒绝，保持实际原拒因。直接组合validator返回void；续战另作显式clone。

## 护盾、护臂、宝箱
共同链 `tests/fixtures/artifact-combat-validation.ts:19-34`：先detach，再开战strategy重编译，真实grants→bounds→sampled facts→neutral→resists replay→mechanisms→M5Runtime。文本helper只在验证后输出canonical文本。

|原组|实际入档边界|保留的真实下游|
|---|---|---|
|bracer initial/stacked/terminal/checkpoints|explorer-bracer-restore:46-53 B拒|:56-90保留sample/actionCounts/tick0 AP和原拒因；:121-141合法1530/AP40/count2及全部逐tick state/events/RNG|
|Lux击杀搬到Irelia owner/item|同类来源入档拒绝，双holder独立补充见报告|:92-119真实sampled facts拒绝，双holder合法finish不减|
|8组AP/empowered/receipt篡改|来源fixture B拒|:161-175对象+JSON原derived ability power、derived empowered magic、sampled stat trigger facts；合法对照保留|
|5m count/100m AP|来源fixture B拒|:143-151真实bound拒绝；pressure:5-13与stress:8-16保留<1000ms、RSS<256MiB门槛|
|护盾133、小幅增减/负数/小数/换目标/缺盾/历史tick/系数|resists:55-61四种来源opening B拒|:63-88原133与8个反例仍由resists replay拒绝|
|动态168→196、刷新吸收结束、holder death|同上|:89-130全部checkpoint与原数值|
|无来源、额外零系数声明|普通无crest仍真实restore|:132-176原declared shield grant及resists shield replay，无篡改被B早拒假冒|
|crest/gargoyle/bracer组合|四种来源opening B拒|:178-209原AP15/145、shield217、600tick及当前/下一战全等，原20s保持|
|宝箱赠crest叠双抗|resists:234-235独立B拒|:236-243原172/180tick、真实resists replay amount+1拒绝|
|宝箱/护臂8checkpoint|chest:86-92 initial/terminal/162/163/262/263/352/469/550/551独立B拒|:135-147每例原JSON/object/文本/逐tick完整比较；原5s工作量保持|
|宝箱同对象warm后原位改grant|来源fixture B拒|:123-133先detach再真实mechanisms，原uncompiled mechanism definitions理由保持|
|冠冕3seed金币正控|crown-gold:134-147 started/after各B拒|:149-196原3seed同timed case，真实G23Progress/MechanicLinks、完整真实battleFacts/history，paid>0、step/commit/Continue幂等不变|
|冠冕金币3负例|原真正restore入口保留|原mechanic receipt link/current settlement totals/G2-3 match progression具体拒因；另直接links/progress对应拒绝|

## 冠冕历史56项
`tests/g2-4a-crown-history.test.ts`：
- M1普通下一准备期仅gold+1仍真实对象/JSON/history入口拒绝；新增B层先拒的路径断言具体B原因，独立真实history carry保留原历史经济拒因。
- 人工首战三冠、M2装备变更、M5资源、M7/S7战斗装备命令：来源合法对照明确B拒，`validateBattleFacts`真实重打并核全部shape/version/initial/events/result/hash，`matchHistoryChecks`保留历史carry/资源/收据。原否定向量与其具体下游拒因保留。
- M8/M9/M10人工普通首战物品也属于固定场景不可公开取得，不能冒称迁移完；所有原数值、命令tick/顺序、实例身份/原资源谱系拒绝仍在直接域层。
- seed26 component/completed reforger真实路线仍完整对象/JSON入档与逐tick。更早B资源谱系拒因明确断言，同时原下游历史资源拒因单独覆盖。
- M9三组移动tick单独比较新增ledger的精确命令/事件变化，旧领域全字段相等；续战每tick还核历史prefix不变及新commands/events tails完全相等。
- requested slot2规范化slot0的两个输入精确不同，测试单独断言差别，不回填ledger；生产保留安全fallback。

## 缓存6项与B安全回归
原crown-cache计数1、外部记录每次重验、可变输入失效、Proxy拒绝、负零、独立clone续算全部保留。新warm owned/current gold/context gold/missing ledger/单次getter快照拒绝在:70-99。B的seed1/42金币、XP、shop/generation、四RNG、eventseq、scope尾段/短前缀/事件、LRU精确字节及污染隔离向量全部最终重跑，不以本轮直接域层替代。

## 锻造器、复制器与预检
- artifact-forge:119-159 tier10/14 pending/manual/timeout仍核原重复领取、offer/来源/price/receipt/gold反例；helper现为void `validateForgeDomain`，三个真实生产validator。JSON复制单列，不称restore。:196后的合成窗口原状态具体B phase拒绝，选后具体command-rejected；普通warmog :176公开路线仍实际恢复。
- pr161:109-145两个人工档案由真实file入口具体B拒绝；逐记录真实validateBattleFacts+完整matchHistoryChecks，奖励域校验、显式续算保留。:264/275/286原tier4复制新授单位、满席escrow、tier14 radiant pending/selected保留全部字段与直接validator；:308/327/346原收据/实例/升级/顺序/轮次反例保留；:384真实内部领域654层四选一但明确人工军队入档拒绝；:412冷Node同样明确B拒并执行直接奖励域validator；:454 forgeID与普通候选拒绝保持。
- bounds:97/155人工护臂来源B拒，直接preflight/count上界在consumer之前仍断言；实际晚期6-7公开奖励/最大pending checkpoint :190/196仍走完整生产恢复，:202普通公开开局正控保持。
- 双holder独立B入口最终位于explorer-bracer-restore:94-96，具体三入口command-rejected；原同例Lux→Irelia来源搬移反例与双holder合法领域finish继续保留，没有只借single-holder入口代替。
