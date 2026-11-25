/** Pure tooltip wording and formatting; no domain dependencies. */
export const SIX_COST_TEXT = {
  'blood-hunter':{apiName:'TFT13_BloodHunter',locale:'zh_cn',description:'【沃里克】吞噬生命值低于@EnemyHealthPercentThreshold*100@%的敌人，为他自身回复@DevourHealing@生命值并获得@ManaPerKill@法力值。'},
  'machine-herald':{apiName:'TFT13_MachineHerald',locale:'zh_cn',description:'【维克托】的固定攻击速度为每秒@AS@次攻击，并将所有额外攻击力、攻击速度和法力值转化为法术强度。<br><br>【维克托】不使用法力值，而是每次攻击获得1混沌能量，并且会在@MaxMana@混沌能量时施放技能。'},
  'banished-mage':{apiName:'TFT13_MissMageTrait',locale:'zh_cn',description:'在你第一次即将被淘汰时，如果【梅尔】在本局游戏的玩家对战回合中施放过至少@MinimumCasts@次技能，那么她会救下你，让你继续存活。<br><br>在那之后，【梅尔】会永久获得@ProcDamageAmp*100@%伤害增幅。<br><br>@TFTUnitProperty.:TFT13_MissMageTrait_TrackerTRA@'},
};
export function annotate(id: string, text: string): string {
  if (id === 'family') text += ' 家人5：从16项奖励中等概率随机抽取（可重复）；玩家对战按阶段推进进度，每场最多完成一次，多出的进度结转；奖励以可分次领取的法球发放；不满5名家人时进度暂停并保留，不会清零。“3个训练假人”这项奖励改为10金币。';
  if (id === 'machine-herald') text += ' 换算比例：每1点额外攻击力、每1%额外攻击速度、每1点额外法力各转化为1点法术强度。';
  if (id === 'scrap') text += ' 战斗开始时把散件临时转化为成装：2极客最多1个，4极客最多3个，6/9极客最多20个符合条件的散件；备战阶段仍显示原散件。6档起，每件基础装备优先临时合成该弈子推荐装备（客户端顺序）里首个含此组件的合法成装，没有则按对局种子等权抽取，金铲铲和金锅锅不转换；9档再把这些临时成装换成对应光明版，没有光明版的保持原样；只在本场战斗有效，护盾计数不变。';
  if (id === 'enforcer') text += ' 开战时通缉最大生命值最高的敌人，头顶通缉标记表示该单位被执法官通缉；被通缉目标阵亡时，执法官们每个目标获得30%攻击速度。标记只表示通缉，不表示眩晕或持续伤害。10档：开战时敌方英雄身上除纹章外的装备本场全部失效（非英雄单位不受影响），装备不转给执法官，战后原样留在原位。';
  if (id === 'firelight') text += ' 每 6 秒冲刺一次：先按这段时间实际受到的伤害回复生命，再撤到 2 格内离最近敌人最远的空格；之后 1 秒内射程无限，4 档起这 1 秒攻击速度 +350%。';
  if (id === 'quickstriker') text += ' 移速 ×1.5；4 档时当前目标阵亡后，下一刻冲刺到新目标旁的空格。';
  // Team-ups need the augment plus both named champions on the board; follow-ups land one tick later (project timing).
  if (id === 'mentorship') text += ' 具体做法：开场冻结凯特琳攻击力的25%给安蓓萨；安蓓萨施法后下一刻凯特琳对同一目标追加一次225%攻击力的物理伤害。';
  if (id === 'reunion') text += ' 具体做法：蔚施法后艾克发3道残影（各50%），艾克施法后蔚向目标所在行发地震波（150%）；只复制伤害。';
  if (id === 'geniuses') text += ' 具体做法：黑默丁格施法后艾克发3道残影（各33%），艾克施法后黑默丁格发3枚导弹（各120%）；协同不会再触发协同。';
  if (id === 'menaces') text += ' 具体做法：爆爆仍计入家人人数但不享受家人自身收益；开场冻结希尔科属性，猴子爆炸生成3个畸变体。';
  if (id === 'unlikely-duo') text += ' 具体做法：施法给另一名伙伴10法力；钢臂非三重结果有10%升为三重。';
  return text;
}

