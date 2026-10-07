# M8 B1：英文来源已归档，部分提取，尚未冻结

## 本次能证明什么

用户提供 `en_us.json` 为 12,061,650 字节，SHA-256 为 `c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3`，与现有 `SOURCE_MANIFEST.rawSha256` 一致。来源获取/存储信息见新归档的 `provenance/manifest.json`。原档独立资料分支归档提交为 `57344b0688c33f4b473fc3ceb70c022ca701945e`。没有改变旧原档、既有导入器、runtime 目录、版本或 digest。

只选唯一 `setData[mutator === "TFTSet13"]`（此文件索引 1、number 13）的 284 项装备成员，与全局 2,055 条 items 交集，再按八种组件及真实 `composition` 选择。结果是八组件、36 成装、36 个不重不漏的无序含自配组合；44 条 `from` 均为 null，不能用它做配方。原始 `apiName` 是稳定键，不按现代名称猜 ID：例如 Red Buff 是 `TFT_Item_RapidFireCannon`，`TFT_Item_RedBuff` 实际为 Sunfire Cape。

`raw/selected-items.json` 保存按 apiName 排序的完整未改记录。`normalized/items.json` 只是规范结构的来源清单，不是运行系数：保留原值、null、unique 与 effects；中文名采用计划临时译名，逐项标记“临时译名，未核对”，仅用于显示；人工确认清单见 `M8_ITEM_NAMES_REVIEW.md`；单位只按本条英文描述的明确格式识别，未证实单位和机制状态显式未知，全部 `runtimeEligible=false`。`normalized/recipes.json` 只冻结原档 composition 的组合事实。每条记录包含原文件 hash、JSON pointer、标准模式选择器和规范 JSON 记录 hash。记录 hash 的序列化为 UTF-8、按键排序、无空格紧凑 JSON（Python ensure_ascii=False），并非原文件对象切片的字节 hash。

## 离线再生成及验证

在仓库根目录运行（仅需 Python 3 标准库）：

```sh
python3 scripts/import-m8-source.py
python3 scripts/import-m8-source.py --check
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_import_m8_source.py' -v
```

默认只读取仓内 `raw/en_us.json.gz`；也可用 `--source /path/to/en_us.json` 指定相同原文件。先验证解压后的完整字节数/hash，再解析。`--check` 不写入文件，核对五份机器生成清单；provenance 的问题/政策/覆盖说明不声称是运行实现。测试包含篡改上游、模式缺失/重复、成员缺失、配方重复、特殊组件误入、44/36 边界、输出篡改、确定性再生成和未知字段保留、逐条 JSON pointer/hash 比对以及 gzip/原件输出一致。它们不是装备数值/机制验收。

## 有限官方核对

独立查阅 Riot 14.23/14.24 公告确认棘刺背心 7% 生命、正义之手 12% 基础全能吸血已包含在原档，未重复覆盖；另核对蓝霸符、破防者等有限锚点，见 `provenance/overrides.json`。这不等于每个参数或脚本已完整审核。用户已补充数值优先级（见计划§2.1.1及 `provenance/source-policy.json`）：巨人杀手采用14.24 effects 的 DamageAmp=2000 Bps（20%）及 HealthThreshold=1750，数值来源冲突已关闭。按随后确认的“desc定语义、effects定数值”，其效果为对目标最大生命值严格大于1750时额外增伤20%。其余未证实细节已以GS-01至GS-04列为非阻塞项目约定；其中同件基础5%与条件20%相加为25%仅是项目约定，不能称作官方证明。采纳值单独保存在 `numericDecisions`，原始 effects 不变。

## B1 尚未完成

- 同版本中文原档由用户稍后补充；44项临时译名清单待人工确认，不阻塞英文研究，暂译不冒充客户端正式名称
- 未完成 14.23→14.24→B 更新的逐字段审核、效果单位/舍入、unique 与占槽及完整机制冻结
- `raw/selected-neutrals.json` 保存标准集九条完整中立候选记录及来源指针/hash，但不提供遭遇/开场/掉落完整表，不能把有基础属性等同于 B7 完成
- 阶段 1、各 .7 的数量/站位/行为、掉率/保底、开场经济与具体单人适配表仍有缺口
- 详细阻塞、下一来源及覆盖见 `provenance/questions.md`、`coverage.json`、`single-player-policy.md`

因此只报告“来源归档和结构/配方验证完成，B1 部分完成”。不合并、不部署，不开始运行规则实现。新来源须按来源真实性与 hash 重新审核，不能单改预期 hash 使测试通过。

## 本次验证记录（2026-10-07）

- 在实施分支基线 `c7c2c0cb14e64998c974eb04957275ed696a4d46` 的独立工作树完成 `--check`、12 项离线 Python 测试及 `npm run build`（包含 TypeScript 检查）；均通过。
- 独立复核逐条对照完整原档、标准模式成员、44 装备/36 无序配方、9 中立候选及其指针/hash；未将来源测试冒充战斗机制测试。
- 本次不改已有运行源、版本/digest、普通 CI 或 B0 性能证据。未重新运行全量游戏/浏览器验收；原 B0 CI 报告仍只证明其原测量提交。构建保留既有大 chunk 警告。
- `data/cdragon-14.24` 保存独立原档提交；本次英文 B1 成果及同一原档副本保存于 `feat/m8-b0-baseline`，没有合并分支。

## 中文暂译与数值裁决补充（2026-10-07）

在 `da808435a56c45830a8b1a0b172314b34676a594` 的来源成果上增补44项计划译名、人工确认清单和获准的来源优先级；原件及 raw 选取记录、apiName、配方和 sourceEffects 均未改变。17项离线测试及再生成检查通过，其中固定摘要验证显示名修改没有改变身份/数值/配方；巨杀按desc取最大生命值>1750、额外2000 Bps；未证实组合细节采用获准的显式项目约定，确认清单见 `M8_PROJECT_CONVENTIONS_REVIEW.md`。B1保持部分完成，未改运行规则或合并分支。
