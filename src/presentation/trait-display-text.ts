/** Pure tooltip wording and formatting; no domain dependencies. */
export const SIX_COST_TEXT = {
  'blood-hunter':{apiName:'TFT13_BloodHunter',locale:'zh_cn',description:'【沃里克】吞噬生命值低于@EnemyHealthPercentThreshold*100@%的敌人，为他自身回复@DevourHealing@生命值并获得@ManaPerKill@法力值。'},
  'machine-herald':{apiName:'TFT13_MachineHerald',locale:'zh_cn',description:'【维克托】的固定攻击速度为每秒@AS@次攻击，并将所有额外攻击力、攻击速度和法力值转化为法术强度。<br><br>【维克托】不使用法力值，而是每次攻击获得1混沌能量，并且会在@MaxMana@混沌能量时施放技能。'},
  'banished-mage':{apiName:'TFT13_MissMageTrait',locale:'zh_cn',description:'在你第一次即将被淘汰时，如果【梅尔】在本局游戏的玩家对战回合中施放过至少@MinimumCasts@次技能，那么她会救下你，让你继续存活。<br><br>在那之后，【梅尔】会永久获得@ProcDamageAmp*100@%伤害增幅。<br><br>@TFTUnitProperty.:TFT13_MissMageTrait_TrackerTRA@'},
};
export function annotate(id: string, text: string): string {
  if (id === 'family') text += ' 家人5：16项等权随机任务；PvP按阶段推进，每战最多完成一次，余量结转；奖励以可部分领取的法球发放。训练假人替代：10金（魔改）。';
  if (id === 'machine-herald') text += ' 额外属性1:1转法强为魔改约定。';
  if (id === 'scrap') text += ' 战斗开始时把散件临时转化为成装：2极客最多1个，4极客最多3个，6/9极客最多20个符合条件的散件；备战阶段仍显示原散件。项目约定：6档起每件基础装备优先临时合成该弈子推荐装备（客户端顺序）里首个含此组件的合法成装，没有则按对局种子等权抽取，金铲铲和金锅锅不转换；9档再把这些临时成装换成对应光明版，没有光明版的保持原样；只在本场战斗有效，护盾计数不变。';
  if (id === 'enforcer') text += ' 开战时通缉最大生命值最高的敌人，头顶通缉标记表示该单位被执法官通缉；被通缉目标阵亡时，执法官们每个目标获得30%攻击速度。标记只表示通缉，不表示眩晕或持续伤害。 项目约定：10档开战时敌方英雄身上除纹章外的装备本场全部失效（非英雄单位不受影响），装备不转给执法官，战后原样留在原位。';
  if (id === 'firelight') text += ' 魔改执行：每 6 秒冲刺，1 秒窗口内无限射程，攻速 +350%（工程取值），按实际承伤回复，撤离到 2 格内落点。';
  if (id === 'quickstriker') text += ' 移速 ×1.5；4 档当前目标阵亡后下一 tick 冲刺至新目标旁合法格（魔改执行）。';
  // Team-ups need the augment plus both named champions on the board; follow-ups land one tick later (project timing).
  if (id === 'mentorship') text += ' 魔改执行：开场冻结凯特琳攻击力的25%给安蓓萨；安蓓萨施法后下一刻凯特琳对同一目标追加一次225%攻击力的物理伤害。';
  if (id === 'reunion') text += ' 魔改执行：蔚施法后艾克发3道残影（各50%），艾克施法后蔚向目标所在行发地震波（150%）；只复制伤害。';
  if (id === 'geniuses') text += ' 魔改执行：黑默丁格施法后艾克发3道残影（各33%），艾克施法后黑默丁格发3枚导弹（各120%）；协同不会再触发协同。';
  if (id === 'menaces') text += ' 魔改执行：爆爆仍计入家人人数但不享受家人自身收益；开场冻结希尔科属性，猴子爆炸生成3个畸变体。';
  if (id === 'unlikely-duo') text += ' 魔改执行：施法给另一名伙伴10法力；钢臂非三重结果有10%升为三重。';
  return text;
}

