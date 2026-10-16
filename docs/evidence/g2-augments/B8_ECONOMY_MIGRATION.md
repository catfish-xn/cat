# B8 经济公开轨迹迁移：明确 seed42 → seed13

## 为什么更换seed

W4扩大到30强化后，seed42的2-1候选不再包含Investment Strategy I，不能继续
测试“实际领取该强化后的利息成长”。使用真实候选包含Investment的seed13，
不注入强化、不改choice、不补金币，也不修改生产经济。
历史真实引擎 `80b893ac66c01b79ec6606b493e141eca3bf00cb` 仍用原seed42及原选择路线。
两边分别调用自己的公开create/select/deploy/equip/buy/reroll/start/step/nextRound。

## 不变的独立算术及拒绝目标

|战前金币|实际掉落金币|计息本金|利息（上限5）|结算金币|Investment成长|
|---|---|---|---|---|---|
|9|1|10|1|16|128 + 8×1 = 136|
|49|1|50|5|60|128 + 8×5 = 168|
|50|1|51|5|61|128 + 8×5 = 168|

先真实掉落1G，再按 floor(本金/10)、上限5计算利息，另加基础收入5G；
PvE胜利收入和连胜收入均0。原三组断言、序列化恢复、重复step/start/choice、
Continue恢复等价与重复Continue拒绝全部保留。
四类篡改仍分别命中原拒绝原因：current settlement totals、history income、
investment、frozen receipt payload；脚本在新旧三场景都实际执行。

## 50G准备的奇偶性修正

真实2-7 preparation两边均65G、73HP、level4、Investment旧存量128。
商店刷新每次花2G，65G不能仅靠刷新达到50G。旧seed42买slot0的1费Trundle；
新seed13按实际公开商店找到奇数费可购买牌，买slot1的1费Zyra，然后刷新到50G。
购买是普通 `buyUnit`，真实扣费、出生serial与后备席状态都保留。
不再假设slot0恒为奇数费，不修改经济规则或直接重写金币。

## 预期轨迹差异

- 旧seed42：2-7战斗205tick / 217个combat事件；掉落cloak、rod、1G、remover。
- 新seed13：2-7战斗292tick / 239个combat事件；掉落bow、sword、1G、remover。
- 两个实际新装备ID均由战前nextItemSerial及其+1推导；本次结果为item-5/item-6，
  不把这些事后ID作为预期来源。nextUnitSerial、scheduleReceipts和冻结掉落表不变。
- 首个完整命令差异就是createMatch的seed42→13，明确保留，不归一化隐藏。
- 排除createMatch后首命令差异位于索引393：旧nextRound，新stepMatch，反映战斗时长变化。
- 首事件字段差异是事件8的 `outcome.mitigated`，63→45。
- 50G分支首命令参数差异是buyUnit的slot0→slot1。

## 可复现字节证据

```sh
BASE_ROOT=/tmp/w4-baseline-80b893a
# 首次如无真实基线：git archive 80b893ac66c01b79ec6606b493e141eca3bf00cb | tar -x -C "$BASE_ROOT"
# 为基线链接当前安装的node_modules，仅共享依赖，不修改旧源码。
node scripts/record-g2-augments-economy.cjs --baseline-root="$BASE_ROOT" --write
node scripts/record-g2-augments-economy.cjs --baseline-root="$BASE_ROOT"
```

脚本只写 `b8-economy-migration.json`；默认无 --write 逐字节复核证据。
179份旧源码/测试文件逐一与Git原件校验；当前全部simulation文件与经济测试的
SHA清单也写入证据，并检查录制期间源码未变化。
原始state流按每次完整state的JSON+换行计算SHA-256与字节长度，不删身份或seed。
完整commands、events、battleEvents以及before/ended/continued状态各自保留SHA、
字节数和首字段差异。不会对旧raw改身份后交给新恢复器。

前缀完整state流：
- 旧：417状态，12,833,787字节，SHA-256 `3a36699d74bd256b8833a0940543f7f2a56b5ba130aa40214ee6b68f3ce437e4`
- 新：446状态，14,288,837字节，SHA-256 `837861a8f13d2b978c0ed6b5d07bf71fc08d28d0687cabd02e566ff785d1703d`

所有3组经济算术和原拒绝检查均已在两个真实引擎通过；本步骤未改测试、生产或共享helper。
