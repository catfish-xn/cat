# 固定6484 / 远端75c8：已授权缺陷修复后的验证，仍未完成②

## 固定来源与完整命令

- 本地：`6484a53c55d5199270fc7822df5ca58c2796819f`，tree `cc027ed92d9c2dd8006b2a84caeb74a965bef243`。
- 父任务确认同tree远端：`75c8be53e8ccc7ac669fb8527175b7f46b573662`，现有PR28；没有reset/rebase/force或合并。
- Node `v22.23.3`，Vite `7.3.6`，TypeScript `5.9.3`，Vitest `5.0.3`。PATH前置 `/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin`。
- 依次原样 `npm test`、`npm run build`、`node docs/evidence/m8-b8/checkpoint-two/measure.mjs`。期间受测src/tests/scripts没有更改，Git tracked始终clean；这些新证据文件在全部受测命令结束后添加。
- 预算后另跑只读 `node /tmp/b8-checkpoint-two/analyze-exports.mjs` 输出Rollup元数据。脚本现按原文归档为`analyze-exports.mjs`，仅输出元数据，不改变构建代码、门禁或测量；其固定/tmp输出路径如实保留。

## 已完成的有界修复及专项

| 类别 | 修复 | 原专项证据 |
|---|---|---|
| 重复实现 | 共用资产/receipt结构验证与单位授予计划；无删除拒绝 |139项与typecheck，f203；体积仍超线|
| 独立命令参考 |独立构造出生/升级/出售事实，完整deep-equal保留|原42+新6项通过，b002|
| 独立掉落经济参考 |有限表/LCG/source/receipt/选择/先金币后利息/serial守恒|24+原audit20=44通过，c4fd；beforeAll7项实际执行|
| 旧生命周期前提 |保留running冻结；独立预期实际Maddie/Lux及选择阻塞/事件|原3文件40项通过，a241|
| 真实UI运行缺陷 |用户批准BoardScene例外，终帧先建对象，保留旧Combat视图至Continue清理|3条合法命令路径显示mock+typecheck，5486；不是Chromium证明|
| 共享B4装备正控 |通过真实选择/合成/装备重建，未改原断言|原四文件117/118，新增4/4；独立5-1注入仍失败，6484|

## 全量终态

`npm test` **exit1**，527.02s：**125文件 = 110通过 + 15失败；1776项 = 1674通过 + 92失败 + 10既有skip**。原日志`post-fixes-full-test.log.gz`。

原M5四构筑每命令/每tick恢复、重复运行state/events相等、插入拒绝零变化的`m5-replay.test.ts`已执行且未失败；它直接跑公共driver，不先卡golden。不能将这项通过等同于33战应用持久化/真实浏览器或②所有组合已完成。既有10skip没有增加；CI174多出的7项beforeAll未执行已解决。

`npm run build` **exit0**，包括原样全局typecheck和Vite构建，原日志`post-fixes-build.log.gz`。预算三build基线488964、生产502900、可达503457，见`post-fixes-budget.json/.log.gz`及`budget-reassessment.md`。两口径仍超B8暂停线，不能宣布预算通过。

## 精确92项剩余账单

下表描述当前第一个失败，不保证修正正控后没有更深真实缺陷，不能统称fixture免责，更不能以提前抛错替代原负控。原CI174首失败证据继续保留。

| 当前失败文件 | 数量 | 当前首层根因 / 必须保留或进一步决定的覆盖 |
|---|---:|---|
|m4-ledger-bound.test.ts|1|旧oracle已解除阻塞，现进一步到maximumLoadout:24；9三星/27成装/id200+的合成最大载荷调用完整Match restore，没有出生/消费。原容量、20MiB、完整事件、隔离和清理断言不能降低；这是明确非正常路线机制容量，需审计确认与合法Match来源控制分层，不能造谱系让它“合法”。|
|m5-growth.test.ts|1|开场Irelia原ID改三星Tristana；combat growth source/step拒绝。应真实购买升级并保125成长/存量delta/幂等，当前未完成。|
|m5-route.test.ts|4|golden contentDigest首个短路，新的完整命令/hash尚未迁移；后续完整构筑/战果检查未因该case通过。|
|m6-integration.test.ts|4|同golden短路，尚未进入本case的完整历史/播放比较；不能计应用恢复通过。|
|m8-b3-audit.test.ts|1|两次裸IF-GRANT cloak无caller receipt/出生，真实combine缺可消费输入；原tick39→40治疗19和历史正控须重建。|
|m8-b4-audit-regressions.test.ts|1|独立5-1 fixture改三星Garen+三成装无九卡/六组件来源；其余共享helper相关原例已过。原Titan/Warmog/Gunblade数值不能按actual重写。|
|m8-b5-equipment-history.test.ts|3|裸两gloves授予及TG合成缺caller来源；需要真实开场选择/合成前缀和完整BattleHistory，不删除历史level上下界/篡改检查。|
|m8-b5-grant-upgrade.test.ts|10|四个无caller receipt的纯planner中间态被当作完整restore正控；其余手塞inventory/id20和二星链无出生。保持纯planner原断言，真实caller恢复与递归购买控制尚未重建；不能以独立自证谱系替代。|
|m8-b5-instances.test.ts|8|item20+/next100手造库存/合成输入，无出生；unique/TG/三槽/第四件拒绝需保留。部分最大装备矩阵超普通15组件路线，需明确机制层和合法Match控制，不无限造资源。|
|m8-b5-queries.test.ts|1|七件手造inventory/serial40无来源，TG临时roll并不证明永久父件出生；原只读/隔离/保留槽语义和合法恢复对照未完成。|
|m8-b5-temporary.test.ts|23|手塞TG item20/serial30无两gloves出生/合成；可用真实2-1 TG修单件，level3/6/7/9强制矩阵与6→7恢复需审计分层/真实buyXp前缀，不能放宽校验。|
|m8-b6-match-wiring.test.ts|3|2项旧前提（concede不再m8全部不变、1-3有真实choice）及1项晚局强阵容注入；冻结plan不变、经济与未解Continue拒绝等仍须逐项保留。|
|m8-b7-audit-vectors.test.ts|7|withGaren原ID改三星无来源；原中立opening/tick/control/death/krug篡改必须先有可恢复合法正控，未完成。|
|m8-b7-match-wiring.test.ts|22|1旧choice前提、17强阵容/装备来源fixture、4 stage-one再次手发真实已授unit2/3导致duplicate unit。不能将其写成引擎双发；真实中立/Herald/鸟恢复向量仍须重建并重新验证。|
|m8-u5-preview.test.ts|3|sturdyArmy改定义/星级和手加单位缺出生；原opening vs live mana/HP/AS、终局当前预览与只读断言不可削弱。|
|合计|**92**|15文件；另110文件通过。|

其中8项golden及B6/B7的3项旧阶段前提为当前已知新语义适配；其余81项是具体缺来源/重复注入的首个失败。没有据此声称所有后续领域实现正确。已确认真实生产缺陷为BoardScene终帧对象未创建，本次已修；真实浏览器同SHA的input局部和M7已有下节通过证据，但完整route仍被golden挡住。

## CI183同SHA最终状态（首跑，不重跑）

[完整run38027546769](https://github.com/catfish-xn/cat/actions/runs/38027546769)，attempt1，固定75c8，2026-10-10 **05:36:49Z**终态 **failure**：15 jobs为3 success、9 failure、3 skipped。

- 成功：[M7 114141496269](https://github.com/catfish-xn/cat/actions/runs/38027546769/job/114141496269)、[U3 114141496144](https://github.com/catfish-xn/cat/actions/runs/38027546769/job/114141496144)、[retention 114141496336](https://github.com/catfish-xn/cat/actions/runs/38027546769/job/114141496336)。retention不能再被概括为golden前置未执行。
- 失败：[test/build 114141496369](https://github.com/catfish-xn/cat/actions/runs/38027546769/job/114141496369)、6个browser、2个input。test原样结果为15文件失败/110通过、92项失败/1674通过/10skip，**563.50s**，与本机失败集合/计数一致。test job里的后续build、headless、performance步骤为skipped；本机原样build成功的证据独立保留，不能替CI未执行步骤盖章。
- 3个skipped jobs：compare-evidence因前置失败未执行，warmup-experiment与heap-diagnostics为2个optional；不算成功，不把可选未跑算新测试skip。
- 两input各自31case passed:true之后，touch-route因golden首检失败，故job仍failure；6browser全部在golden前置失败，没有进入其真实浏览器路线。M7/U3/retention的成功和其他失败不得互相替代。
- 原GitHub run/jobs元数据、test/U3/retention日志与artifact完整性清单已归档`ci183-*`；12个已执行job的checkout均核对75c8，12份原artifact共53975001 B由监控保存并核对GitHub SHA256。未将这些大ZIP放入仓库。
- M7现有1.30预算门禁通过仅说明全局口径502900/424763=1.183954；**B8独立13000 B暂停线仍超**，不构成②签收。

## 尚未执行/通过与下一步边界

- [golden静态分析](golden-static-review.md)给出精确旧SHA256和审计迁移条件；当前没有刷新golden、没有改变assert/hash范围。它阻断原m5-route/m6integration，并阻断`verify-m5-browser`进入Chromium；CI180/181这些失败作业不能作为UI真实验证。headless/compare等未执行项不能冒称通过；CI183 retention实际成功，见下方独立记录。
- 15组件必须保留完整10 LootReceipt+5 supply ScheduleReceipt口径；旧B8延期body仅数ScheduleReceipt不能直接解除、不能降至5、不能伪装来源。既有B8/B9延期仍原样，不扩skip。
- CI183固定远端75c8已有真实UI证据：input-dev [job114141496349](https://github.com/catfish-xn/cat/actions/runs/38027546769/job/114141496349) 的verify-m5-input为31cases passed:true、173.167s；input-preview [job114141496391](https://github.com/catfish-xn/cat/actions/runs/38027546769/job/114141496391) 为31cases passed:true、231.077s。原undefined.input未重现，两者仍保留5项既有B8 skip；后续touch-route都因golden digest失败，**整个input job仍failure**。
- 同SHA [M7 job114141496269](https://github.com/catfish-xn/cat/actions/runs/38027546769/job/114141496269) 整job success：presentation、五视口、subpath和budget通过，原触屏双击Continue语义包含在既有门禁。CI生产gzip9 502900与本机同值；相对M7base424763比1.183954，交互545/525ms。原日志归档为ci183-input-dev.log.gz、ci183-input-preview.log.gz、ci183-m7.log.gz。本报告没有本机运行Chromium。
- 同run六browser dev/preview构筑仍在golden前置失败、未进入浏览器路线；不能把上述局部input/M7通过写成全CI、完整route或②签收。
- ②还有完整容量出售/同tick多来源/部分击杀/立即合并与stock-delta/G12/终局恢复组合未全面验收；纯fold和独立参考向量不替代真实公共路径。golden与上述恢复正控仍未完成，不能提前解除延期。
- 可明确保留原数值且用公开命令重建的正控可以在授权缺陷范围继续；M4超普通容量、B5无caller中间态等涉及验收分层的点先报告，不能另造宽松验收。预算报告后等待预算决定才新增功能/继续②未做功能；③/B9不启，②不自签，PR不合。
