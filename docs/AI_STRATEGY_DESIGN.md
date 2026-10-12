# AI机器人策略设计

## 概述

为8人TFT游戏设计AI机器人，能在人数不足时自动填充。AI需要能够：
- 购买和出售英雄
- 部署站位
- 合成和装备物品
- 管理经济（升级/刷新）

---

## 一、AI难度定义

### Easy（简单）
- 随机购买英雄
- 固定站位模式
- 不考虑装备优先级
- 不吃利息
- **目标**：能完成游戏流程，新手陪练

### Medium（中等）  
- 优先购买能升星的英雄
- 前后排分离站位
- 装备按类型分配
- 简单经济管理（利息）
- **目标**：有一定挑战性，正常对局

### Hard（困难）
- 多阵容理解
- 针对对手调整
- 装备优先级复杂
- 完整经济策略
- **目标**：接近玩家水平

---

## 二、决策系统架构

### 2.1 决策流程

```
每个准备阶段:
1. 观察状态 (MatchState)
   ├─ 金币数量
   ├─ 当前等级
   ├─ 商店内容
   ├─ 场上英雄
   ├─ 背包英雄
   ├─ 装备列表
   └─ HP和连胜/连败

2. 制定计划 (DecisionEngine)
   ├─ 经济决策 (升级 vs 存钱 vs 刷新)
   ├─ 购买决策 (买哪个英雄)
   ├─ 出售决策 (卖哪个英雄)
   ├─ 装备决策 (合成+装备谁)
   └─ 站位决策 (如何部署)

3. 执行命令
   ├─ buyUnit
   ├─ sellUnit
   ├─ deploy
   ├─ combine
   ├─ equip
   ├─ buyXp
   └─ reroll
```

### 2.2 核心类设计

```typescript
// AI玩家实例
class BotPlayer {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  state: MatchState;
  engine: DecisionEngine;

  async makeDecisions(): Promise<Command[]> {
    return this.engine.makeDecisions(this.state);
  }
}

// 决策引擎
class DecisionEngine {
  constructor(
    private difficulty: Difficulty,
    private strategies: {
      economy: EconomyStrategy;
      buy: BuyStrategy;
      position: PositionStrategy;
      item: ItemStrategy;
    }
  ) {}

  async makeDecisions(state: MatchState): Promise<Command[]> {
    const commands: Command[] = [];

    // 按优先级执行
    commands.push(...await this.strategies.economy.decide(state));
    commands.push(...await this.strategies.buy.decide(state));
    commands.push(...await this.strategies.item.decide(state));
    commands.push(...await this.strategies.position.decide(state));

    return commands;
  }
}
```

---

## 三、策略实现

### 3.1 经济策略 (EconomyStrategy)

#### Medium难度实现

```typescript
class MediumEconomyStrategy implements EconomyStrategy {
  decide(state: MatchState): Command[] {
    const { gold, level, round } = state;
    const commands: Command[] = [];

    // 规则1: 前期(1-3轮)不升级，攒钱
    if (round <= 3) {
      return [];
    }

    // 规则2: 金币>=50，升级到4级
    if (level === 3 && gold >= 50) {
      commands.push({ action: 'buyXp', params: {} });
      return commands;
    }

    // 规则3: 金币>=60，升级到5级
    if (level === 4 && gold >= 60) {
      commands.push({ action: 'buyXp', params: {} });
      return commands;
    }

    // 规则4: 4-1轮后，金币>=70，升级到6级
    if (round >= 15 && level === 5 && gold >= 70) {
      commands.push({ action: 'buyXp', params: {} });
      return commands;
    }

    // 规则5: 金币>60且利息<5，考虑刷新
    const interest = Math.min(Math.floor(gold / 10), 5);
    if (gold > 60 && interest < 5) {
      // 如果商店没有想要的英雄，刷新
      if (!this.hasDesirableUnit(state.shop, state.preparation)) {
        commands.push({ action: 'reroll', params: {} });
      }
    }

    return commands;
  }

  private hasDesirableUnit(shop: Shop, prep: GameState): boolean {
    // 检查是否有能升星的英雄
    for (const slot of shop.slots) {
      if (slot.status !== 'available') continue;
      
      const onBench = prep.units.filter(u => 
        u.team === 'player' && 
        u.definitionId === slot.definitionId
      ).length;

      // 有2个同名英雄，再买一个能升星
      if (onBench >= 2) return true;
    }

    return false;
  }
}
```

#### Easy难度（简化版）

```typescript
class EasyEconomyStrategy implements EconomyStrategy {
  decide(state: MatchState): Command[] {
    const { gold, level, round } = state;

    // 简单规则：金币>=50就升级
    if (gold >= 50 && level < 9) {
      return [{ action: 'buyXp', params: {} }];
    }

    // 金币>30就刷新
    if (gold > 30 && Math.random() < 0.3) {
      return [{ action: 'reroll', params: {} }];
    }

    return [];
  }
}
```

---

### 3.2 购买策略 (BuyStrategy)

#### Medium难度实现

```typescript
class MediumBuyStrategy implements BuyStrategy {
  decide(state: MatchState): Command[] {
    const { shop, gold, preparation } = state;
    const commands: Command[] = [];

    // 优先级系统
    const priorities = this.calculatePriorities(shop, preparation);

    // 按优先级购买
    for (const { slot, priority } of priorities) {
      const unit = UNIT_DEFINITIONS[shop.slots[slot].definitionId];
      if (gold >= unit.cost) {
        commands.push({ 
          action: 'buyUnit', 
          params: { slot, generation: shop.generation } 
        });
        gold -= unit.cost;

        // 背包满了就停止
        if (this.getBenchUnits(preparation).length >= 9) break;
      }
    }

    return commands;
  }

  private calculatePriorities(
    shop: Shop, 
    prep: GameState
  ): Array<{ slot: number; priority: number }> {
    const priorities: Array<{ slot: number; priority: number }> = [];

    shop.slots.forEach((slot, index) => {
      if (slot.status !== 'available') return;

      let priority = 0;

      // 因素1: 能升星 (最高优先级)
      const canUpgrade = this.canUpgradeWith(slot.definitionId, prep);
      if (canUpgrade) priority += 100;

      // 因素2: 高费卡
      const cost = UNIT_DEFINITIONS[slot.definitionId].cost;
      priority += cost * 10;

      // 因素3: 职业/种族协同
      const synergy = this.calculateSynergy(slot.definitionId, prep);
      priority += synergy * 5;

      priorities.push({ slot: index, priority });
    });

    // 按优先级排序
    return priorities.sort((a, b) => b.priority - a.priority);
  }

  private canUpgradeWith(definitionId: string, prep: GameState): boolean {
    const count = prep.units.filter(u => 
      u.team === 'player' && 
      u.definitionId === definitionId
    ).length;

    // 2个→3个可升2星，5个→6个可升3星
    return count === 2 || count === 5;
  }

  private calculateSynergy(definitionId: string, prep: GameState): number {
    const unit = UNIT_DEFINITIONS[definitionId];
    let synergy = 0;

    // 计算职业协同
    const jobCounts = new Map<string, number>();
    prep.units.forEach(u => {
      if (u.team !== 'player') return;
      const def = UNIT_DEFINITIONS[u.definitionId];
      def.jobs.forEach(job => {
        jobCounts.set(job, (jobCounts.get(job) || 0) + 1);
      });
    });

    unit.jobs.forEach(job => {
      synergy += jobCounts.get(job) || 0;
    });

    return synergy;
  }
}
```

#### Easy难度（简化版）

```typescript
class EasyBuyStrategy implements BuyStrategy {
  decide(state: MatchState): Command[] {
    const { shop, gold, preparation } = state;
    const commands: Command[] = [];

    // 随机购买能买得起的
    for (let i = 0; i < shop.slots.length; i++) {
      const slot = shop.slots[i];
      if (slot.status !== 'available') continue;

      const unit = UNIT_DEFINITIONS[slot.definitionId];
      if (gold >= unit.cost && Math.random() < 0.5) {
        commands.push({ 
          action: 'buyUnit', 
          params: { slot: i, generation: shop.generation } 
        });
        gold -= unit.cost;

        if (this.getBenchUnits(preparation).length >= 9) break;
      }
    }

    return commands;
  }
}
```

---

### 3.3 站位策略 (PositionStrategy)

#### Medium难度实现

```typescript
class MediumPositionStrategy implements PositionStrategy {
  decide(state: MatchState): Command[] {
    const { preparation } = state;
    const commands: Command[] = [];

    // 获取所有待部署单位（背包里的）
    const benchUnits = preparation.units.filter(u => 
      u.team === 'player' && 
      this.isOnBench(u.location)
    );

    // 分类：坦克 vs 输出
    const tanks = benchUnits.filter(u => this.isTank(u));
    const dps = benchUnits.filter(u => !this.isTank(u));

    // 坦克放前排（row 0-1）
    tanks.forEach((unit, index) => {
      const pos = this.findFrontPosition(preparation.board, index);
      if (pos) {
        commands.push({
          action: 'deploy',
          params: { 
            unitId: unit.id, 
            location: pos 
          }
        });
      }
    });

    // 输出放后排（row 2-3）
    dps.forEach((unit, index) => {
      const pos = this.findBackPosition(preparation.board, index);
      if (pos) {
        commands.push({
          action: 'deploy',
          params: { 
            unitId: unit.id, 
            location: pos 
          }
        });
      }
    });

    return commands;
  }

  private isTank(unit: Unit): boolean {
    const stats = getUnitStats(unit);
    // HP高于平均值1.5倍视为坦克
    return stats.maxHp > 700;
  }

  private findFrontPosition(
    board: Board, 
    index: number
  ): UnitLocation | null {
    // 前排优先位置：row 0, col 3-4 (中间)
    const frontPositions = [
      { row: 0, col: 3 },
      { row: 0, col: 4 },
      { row: 0, col: 2 },
      { row: 0, col: 5 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
    ];

    return frontPositions.find(pos => 
      !board.some(u => u.location.row === pos.row && u.location.col === pos.col)
    ) || null;
  }

  private findBackPosition(
    board: Board, 
    index: number
  ): UnitLocation | null {
    // 后排优先位置：row 3, col 分散
    const backPositions = [
      { row: 3, col: 3 },
      { row: 3, col: 4 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 3, col: 2 },
      { row: 3, col: 5 },
    ];

    return backPositions.find(pos => 
      !board.some(u => u.location.row === pos.row && u.location.col === pos.col)
    ) || null;
  }
}
```

---

### 3.4 装备策略 (ItemStrategy)

#### Medium难度实现

```typescript
class MediumItemStrategy implements ItemStrategy {
  decide(state: MatchState): Command[] {
    const { items, preparation } = state;
    const commands: Command[] = [];

    // 1. 优先合成完成装备
    const combineCommands = this.decideCombine(items);
    commands.push(...combineCommands);

    // 2. 装备给英雄
    const equipCommands = this.decideEquip(items, preparation);
    commands.push(...equipCommands);

    return commands;
  }

  private decideCombine(items: ItemInstance[]): Command[] {
    const commands: Command[] = [];
    const components = items.filter(i => 
      ITEM_DEFINITIONS[i.definitionId].kind === 'component'
    );

    // 简单策略：两个不同组件合成
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const a = components[i];
        const b = components[j];

        // 检查是否能合成
        if (this.canCombine(a.definitionId, b.definitionId)) {
          commands.push({
            action: 'combine',
            params: { itemId1: a.id, itemId2: b.id }
          });

          // 每次只合成一个
          return commands;
        }
      }
    }

    return commands;
  }

  private decideEquip(
    items: ItemInstance[], 
    prep: GameState
  ): Command[] {
    const commands: Command[] = [];

    // 获取未装备的完成品
    const unequipped = items.filter(i => 
      !i.ownerId && 
      ITEM_DEFINITIONS[i.definitionId].kind === 'completed'
    );

    for (const item of unequipped) {
      // 找最适合的英雄
      const bestUnit = this.findBestUnitForItem(item, prep);
      if (bestUnit) {
        // 找空闲装备栏
        const slot = bestUnit.items.findIndex(i => i === null);
        if (slot !== -1) {
          commands.push({
            action: 'equip',
            params: {
              itemId: item.id,
              unitId: bestUnit.id,
              slot
            }
          });
        }
      }
    }

    return commands;
  }

  private findBestUnitForItem(
    item: ItemInstance, 
    prep: GameState
  ): Unit | null {
    const itemDef = ITEM_DEFINITIONS[item.definitionId];
    const candidates = prep.units.filter(u => u.team === 'player');

    // 根据装备类型选择英雄
    const isADItem = this.isADItem(itemDef);
    const isAPItem = this.isAPItem(itemDef);
    const isTankItem = this.isTankItem(itemDef);

    for (const unit of candidates) {
      const stats = getUnitStats(unit);

      if (isADItem && stats.attackDamage > 50) return unit;
      if (isAPItem && stats.abilityPower > 30) return unit;
      if (isTankItem && stats.maxHp > 700) return unit;
    }

    // 如果没有完美匹配，随便给一个有空位的
    return candidates.find(u => 
      u.items.some(i => i === null)
    ) || null;
  }

  private isADItem(item: ItemDefinition): boolean {
    return item.effects.some(e => 
      e.kind === 'statPercentBps' && e.stat === 'attackDamage'
    );
  }

  private isAPItem(item: ItemDefinition): boolean {
    return item.effects.some(e => 
      e.kind === 'statFlat' && e.stat === 'abilityPower'
    );
  }

  private isTankItem(item: ItemDefinition): boolean {
    return item.effects.some(e => 
      e.kind === 'statPercentBps' && 
      (e.stat === 'armor' || e.stat === 'magicResist')
    );
  }
}
```

---

## 四、实现优先级

### 阶段1：最小可用AI (Easy)
- ✅ 随机购买
- ✅ 固定站位模式
- ✅ 不管装备
- **目标**：能完成游戏，不报错

### 阶段2：基础AI (Medium)
- ✅ 升星优先购买
- ✅ 前后排站位
- ✅ 简单装备分配
- ✅ 利息管理
- **目标**：正常对局体验

### 阶段3：进阶AI (Hard)
- ⏳ 阵容理解
- ⏳ 针对性调整
- ⏳ 复杂经济策略
- **目标**：有挑战性

---

## 五、测试方案

### 单元测试
```typescript
describe('MediumBuyStrategy', () => {
  it('should prioritize units that can upgrade', () => {
    const state = createMockState({
      shop: [
        { status: 'available', definitionId: 'ahri' },
        { status: 'available', definitionId: 'senna' }
      ],
      bench: [
        createUnit('ahri'),
        createUnit('ahri') // 2个Ahri，再买一个能升星
      ],
      gold: 10
    });

    const strategy = new MediumBuyStrategy();
    const commands = strategy.decide(state);

    expect(commands[0].params.slot).toBe(0); // 优先买Ahri
  });
});
```

### 集成测试
```typescript
describe('BotPlayer full game', () => {
  it('should complete a game without errors', async () => {
    const bot = new BotPlayer('bot1', 'TestBot', 'medium');
    
    // 模拟30轮
    for (let round = 1; round <= 30; round++) {
      const commands = await bot.makeDecisions();
      
      // 执行命令不应报错
      expect(() => {
        commands.forEach(cmd => executeCommand(bot.state, cmd));
      }).not.toThrow();
    }

    // Bot应该活到最后或被淘汰
    expect(bot.state.playerHp >= 0).toBe(true);
  });
});
```

---

## 六、性能考虑

### 决策时间限制
```typescript
class DecisionEngine {
  private readonly MAX_DECISION_TIME = 2000; // 2秒

  async makeDecisions(state: MatchState): Promise<Command[]> {
    const start = Date.now();
    const commands: Command[] = [];

    // 超时保护
    const addIfTime = (fn: () => Command[]) => {
      if (Date.now() - start > this.MAX_DECISION_TIME) {
        return;
      }
      commands.push(...fn());
    };

    addIfTime(() => this.strategies.economy.decide(state));
    addIfTime(() => this.strategies.buy.decide(state));
    addIfTime(() => this.strategies.item.decide(state));
    addIfTime(() => this.strategies.position.decide(state));

    return commands;
  }
}
```

### 并行AI
```typescript
// 8个AI可以并行决策
async function runAllBotsDecisions(bots: BotPlayer[]): Promise<Map<string, Command[]>> {
  const results = await Promise.all(
    bots.map(bot => bot.makeDecisions())
  );

  return new Map(
    bots.map((bot, i) => [bot.id, results[i]])
  );
}
```

---

## 附录：配置文件

**server/src/ai/config/medium.json**
```json
{
  "difficulty": "medium",
  "economy": {
    "saveForInterest": true,
    "targetInterest": 5,
    "levelUpThresholds": {
      "4": 50,
      "5": 60,
      "6": 70,
      "7": 80,
      "8": 90
    },
    "rerollThreshold": 60
  },
  "buy": {
    "upgradeWeight": 100,
    "costWeight": 10,
    "synergyWeight": 5
  },
  "position": {
    "tankRows": [0, 1],
    "dpsRows": [2, 3],
    "tankHpThreshold": 700
  },
  "items": {
    "autoCombine": true,
    "equipPriority": ["AD", "AP", "Tank"]
  }
}
```

---

## 给GPT的实施提示

1. **从Easy开始**：先实现能跑的AI，再优化
2. **逐个策略实现**：Economy → Buy → Position → Item
3. **充分日志**：每个决策都打log，方便调试
4. **测试驱动**：写一个测试，实现一个功能
5. **性能监控**：记录每个AI的决策时间

完整实现代码见：`IMPLEMENTATION_PHASE3.md`
