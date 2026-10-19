// 14.24b map22 + official zh_cn stringtable; floats normalized to six decimal places.
import { freezeContent } from '../content/freeze';
export const P4_SOURCE = freezeContent({
  "UnstoppableForce": {
    "id": "TFT13_GoopBuff_UnstoppableForce",
    "pointer": "{9b302b6d}",
    "name": "势不可挡",
    "description": "参与击杀后，冲锋至下一个目标并将该目标晕眩@StunDuration@秒，然后治疗自身@PctHealthHeal@%最大生命值。",
    "values": {
      "StunDuration": 1.5,
      "PctHealthHeal": 10.0
    }
  },
  "CertainDeath": {
    "id": "TFT13_GoopBuff_CertainDeath",
    "pointer": "{e2fec80c}",
    "name": "深入敌阵",
    "description": "在第一次施放技能时，跃向多个敌人并在半径@HexRadius@格的区域内造成@StunDuration@秒晕眩，并获得@BonusAS*100@%攻速和@BonusOmnivamp*100@%全能吸血。",
    "values": {
      "BonusAS": 0.25,
      "BonusOmnivamp": 0.2,
      "HexRadius": 2.0,
      "StunDuration": 1.5
    }
  },
  "DramaticEntrance": {
    "id": "TFT13_GoopBuff_DramaticEntrance",
    "pointer": "{6a5e8bac}",
    "name": "震撼登场",
    "description": "战斗开始时：跳离战场。在@Delay@秒后，带着@IncreasedMaxHealthPercent*100@%额外最大生命值登场并对所有敌人造成@StunDuration@秒<TFTKeyword>晕眩</TFTKeyword>。",
    "values": {
      "IncreasedMaxHealthPercent": 0.55,
      "Delay": 6.0,
      "StunDuration": 2.0
    }
  },
  "Repulsor": {
    "id": "TFT13_GoopBuff_Repulsor",
    "pointer": "{cda514bb}",
    "name": "斥力发生器",
    "description": "获得@BonusAS*100@%攻击速度。在施放技能时，如果与其目标相隔的距离在@KnockbackRange@格内，则将目标击退。",
    "values": {
      "BonusAS": 0.35,
      "KnockbackRange": 2.0
    }
  },
  "Invisibility": {
    "id": "TFT13_GoopBuff_Invisibility",
    "pointer": "{67e2e886}",
    "name": "隐形",
    "description": "每过@StealthTimer@秒，进入隐形状态@StealthDuration@秒。下一次攻击拥有@BonusCrit*100@%暴击几率。",
    "values": {
      "BonusCrit": 1.0,
      "StealthTimer": 6.0,
      "StealthDuration": 1.0
    }
  },
  "EvenInDeath": {
    "id": "TFT13_GoopBuff_EvenInDeath",
    "pointer": "{56b63bc8}",
    "name": "最后机会",
    "description": "在第一次阵亡时，以满生命值复活、获得@BonusAttackSpeed*100@%攻击速度和@BonusOmnivamp*100@%全能吸血，但每秒损失@PercentHealthLoss*100@%生命值。",
    "values": {
      "PercentHealthLoss": 0.125,
      "BonusOmnivamp": 0.2,
      "BonusAttackSpeed": 0.5,
      "MoveSpeed": 500.0
    }
  },
  "ScuttleFamiliar": {
    "id": "TFT13_GoopBuff_ScuttleFamiliar",
    "pointer": "{66e7e024}",
    "name": "真的会蟹",
    "description": "在阵亡时，召唤一个螃蟹，它拥有这个弈子的@PctOfDefensiveStats@%最大生命值、护甲与魔抗。",
    "values": {
      "PctOfDefensiveStats": 100.0
    }
  },
  "WolfFamiliars": {
    "id": "TFT13_GoopBuff_WolfFamiliars",
    "pointer": "{b92a45ae}",
    "name": "双狼佣兽",
    "description": "召唤两头不可被选取的狼，它们拥有@TooltipAS@攻击速度和这个弈子的@PercentAD*100@%攻击力。",
    "values": {
      "PercentAD": 0.5,
      "TooltipAS": 0.9
    }
  },
  "HungerForPower": {
    "id": "TFT13_GoopBuff_HungerForPower",
    "pointer": "{6c4a9ea4}",
    "name": "渴望能量",
    "description": "战斗开始时：吃掉相距最近的那个友军，然后获得该友军@HealthAndADPercent@%生命值和攻击力。",
    "values": {
      "HealthAndADPercent": 60.0
    }
  },
  "CenteroftheUniverse": {
    "id": "TFT13_GoopBuff_CenteroftheUniverse",
    "pointer": "{5a47d9df}",
    "name": "星原之准",
    "description": "获得@NumStars@颗星星环绕于这个弈子。每颗星星造成@MissileDamage@魔法伤害，并且轨道会延伸以命中这个弈子的当前目标。",
    "values": {
      "MissileDamage": 75.0,
      "{0911adb5}": 75.0,
      "NumStars": 6.0
    }
  },
  "DeftHands": {
    "id": "TFT13_GoopBuff_DeftHands",
    "pointer": "{3ef46724}",
    "name": "小我多多",
    "description": "获得@MiniCount@个迷你弈子，每@AttackCadence@次攻击可造成相当于@PercentAD*100@% (%i:scaleAD%)攻击力的伤害。它们的攻击会使护甲降低@ArmorReduction@。",
    "values": {
      "PercentAD": 0.3,
      "MiniCount": 3.0,
      "ArmorReduction": 5.0,
      "AttackCadence": 3.0
    }
  }
});
