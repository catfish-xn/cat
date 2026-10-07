# M8 B1 状态：装备来源已签收，原计划非装备部分未签收

## 本轮精确计数

- 已完成装备来源：**44 / 44**；配方：**36 / 36**；effects字段：**218 / 218**
- 已批准项目约定：**5**（巨人杀手4项、窃贼等级分档1项）
- 剩余待逐项确认项目约定：**41**，按用户授权暂行、不阻塞装备来源签收
- 装备未知/冲突项：**0**。这指项目中尚未作出处理决定的问题，不代表每条语义都有官方执行脚本证据
- 中文名称核对已移出B1。44项临时译名仍待用户稍后确认，不计入上述未知/约定数量

装备签收细表见 [M8_B1_EQUIPMENT_ACCEPTANCE.md](M8_B1_EQUIPMENT_ACCEPTANCE.md)；约定清单见 [M8_PROJECT_CONVENTIONS_REVIEW.md](M8_PROJECT_CONVENTIONS_REVIEW.md)；中文遗留项见 [M8_LOCALIZATION_FOLLOWUP.md](M8_LOCALIZATION_FOLLOWUP.md)。

## 原始证据与可重现性

用户提供en_us.json 12,061,650字节，SHA-256 c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3，与已有SOURCE_MANIFEST一致。独立数据分支提交57344b0688c33f4b473fc3ceb70c022ca701945e归档原件gzip。本轮保留原件/选取原记录/apiName/composition/effects原值，没有修改原始数值。

标准模式唯一选择器setData[mutator===TFTSet13]，与全局items交集后精确选8组件+36成装。44条from为null，配方均取composition。provenance/item-review-a.json和item-review-b.json逐字段记录原值、单位、整数/Bps/tick、使用或不使用决定、desc占位符和项目约定；source hash与JSON pointer可回查。normalizedEffects是来源冻结结果，未导入运行引擎。

官方14.24/B无对应改动时采用14.24effects；desc定语义。反甲7%生命与正义12%基础全能吸血已含于源档，不重复覆盖。巨杀采用20%条件额外增伤、目标maxHP>1750；同件5%+20%=25%为已批准GS约定。窃贼本体20%暴击、150生命来自客户端；7级分档和35/8池权重为已批准TG-01，不冒称官方历史随机表。

## 再生成与验证

```sh
python3 scripts/import-m8-source.py
python3 scripts/import-m8-source.py --check
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_import_m8_source.py' -v
npm run build
```

20项离线来源测试覆盖hash门控、模式/配方边界、218字段Decimal独立换算、原件与gzip一致、再生成、篡改、显示名不影响身份数值配方、GS项目边界参考样例、TG等级6/7及280/595池组合。独立审查覆盖全部44项。以上不是尚未实现的装备战斗/存档/回放执行测试；没有重新运行完整浏览器验收或改B0性能证据。

## 原计划完整B1尚未签收

原计划B1还含五类非装备工作：开场经济、遭遇映射、中立单位行为、掉落/保底、具体单人政策，均尚未闭合。九条中立候选原记录已归档，不等于遭遇表或掉率已取得。装备子项完成不能冒充整个原计划B1完成；若将本轮B1签收范围限定为装备，应由用户明确调整范围。

B2–B10运行实现与相关验收保持原计划依赖。没有改运行源、规则/content版本、digest、普通CI、main或部署，没有合并分支。
