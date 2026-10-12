# 8人多人架构设计方案

## 概述

将当前单人TFT游戏改造为**8人在线对战**版本，支持**AI机器人填充**。

**目标：**
- 8人同时游戏，互相对战
- 人数不足时AI机器人自动填充
- 服务端权威架构，防作弊
- 支持4核8G服务器，3-4好友规模

---

## 一、架构对比

### 当前架构（M8单人版）
```
浏览器客户端
├─ src/simulation/match.ts (游戏规则引擎)
│  ├─ 确定性RNG (lcg32-v1)
│  ├─ 命令模式 (buyUnit/deploy/combine...)
│  └─ 完整状态 (MatchState)
├─ src/rendering/ (Phaser UI)
└─ src/persistence/ (IndexedDB本地存档)
```

### 目标架构（8人多人版）
```
                服务端 (Node.js/Bun)
                ├─ WebSocket服务
                ├─ 房间管理 (RoomManager)
                ├─ 游戏引擎 (复用simulation/)
                ├─ AI引擎 (BotPlayer)
                └─ 匹配系统 (MatchmakingService)
                        ↓↑ WebSocket
        ┌───────────────┼───────────────┐
    客户端1           客户端2         客户端N
    (Phaser UI)      (Phaser UI)    (Phaser UI)
```

---

## 二、核心模块设计

### 2.1 服务端模块

#### 目录结构
```
server/
├─ index.ts                 # 入口，启动WebSocket服务
├─ types/                   # 类型定义
│  ├─ room.ts              # 房间相关类型
│  ├─ player.ts            # 玩家类型
│  └─ protocol.ts          # 通信协议
├─ room/
│  ├─ RoomManager.ts       # 房间管理器
│  ├─ Room.ts              # 单个房间逻辑
│  ├─ MatchmakingService.ts # 对战配对
│  └─ EliminationSystem.ts  # 淘汰机制
├─ ai/
│  ├─ BotPlayer.ts         # 机器人玩家
│  ├─ DecisionEngine.ts    # AI决策引擎
│  ├─ strategies/          # 策略模块
│  │  ├─ BuyStrategy.ts    # 购买策略
│  │  ├─ PositionStrategy.ts # 站位策略
│  │  ├─ ItemStrategy.ts   # 装备策略
│  │  └─ EconomyStrategy.ts # 经济策略
│  └─ difficulty/          # 难度配置
│     ├─ Easy.ts
│     ├─ Medium.ts
│     └─ Hard.ts
├─ simulation/             # 复制自客户端src/simulation/
│  ├─ match.ts            # (不变，直接复用)
│  ├─ combat.ts
│  └─ content/
└─ sync/
   ├─ BroadcastService.ts  # 状态广播
   └─ CommandValidator.ts  # 命令验证
```

#### 关键类型定义

**server/types/room.ts:**
```typescript
export interface Room {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  bots: BotPlayer[];
  round: number;
  matchups: Matchup[];
  createdAt: number;
  settings: RoomSettings;
}

export interface Player {
  id: string;
  name: string;
  type: 'human' | 'bot';
  state: MatchState;          // 复用simulation/match-types.ts
  hp: number;
  isEliminated: boolean;
  rank: number | null;
  socket?: WebSocket;
}

export interface Matchup {
  round: number;
  player1Id: string;
  player2Id: string;
  result: CombatResult | null;
}

export interface RoomSettings {
  maxPlayers: number;         // 默认8
  botFillEnabled: boolean;    // 允许AI填充
  botDifficulty: 'easy' | 'medium' | 'hard';
  prepTimeSeconds: number;    // 准备阶段时长
}
```

**server/types/protocol.ts:**
```typescript
// 客户端→服务端
export type ClientMessage =
  | { type: 'createRoom'; settings: RoomSettings }
  | { type: 'joinRoom'; roomId: string; playerName: string }
  | { type: 'ready' }
  | { type: 'command'; action: CommandAction; params: any }
  | { type: 'leaveRoom' };

export type CommandAction =
  | 'buyUnit'
  | 'sellUnit'
  | 'deploy'
  | 'combine'
  | 'equip'
  | 'reroll'
  | 'buyXp'
  | 'lockShop'
  | 'start';

// 服务端→客户端
export type ServerMessage =
  | { type: 'roomCreated'; roomId: string }
  | { type: 'roomJoined'; room: RoomSnapshot }
  | { type: 'playerJoined'; player: PlayerSnapshot }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'gameStart'; initialStates: Record<string, MatchState> }
  | { type: 'stateUpdate'; playerId: string; state: MatchState; events: MatchEvent[] }
  | { type: 'roundStart'; round: number; matchups: Matchup[] }
  | { type: 'combatEnd'; results: CombatSummary[] }
  | { type: 'playerEliminated'; playerId: string; rank: number }
  | { type: 'gameOver'; rankings: PlayerRanking[] }
  | { type: 'error'; message: string };

export interface RoomSnapshot {
  id: string;
  players: PlayerSnapshot[];
  status: Room['status'];
  settings: RoomSettings;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  type: 'human' | 'bot';
  hp: number;
  isReady: boolean;
  isEliminated: boolean;
}

export interface CombatSummary {
  player1Id: string;
  player2Id: string;
  result: CombatResult;
  damageDealt: number;
}

export interface PlayerRanking {
  playerId: string;
  name: string;
  rank: number;
  finalHp: number;
}
```

### 2.2 AI机器人设计

#### 简化AI决策流程
```typescript
// server/ai/DecisionEngine.ts
export class DecisionEngine {
  constructor(
    private difficulty: 'easy' | 'medium' | 'hard',
    private strategies: {
      buy: BuyStrategy;
      position: PositionStrategy;
      item: ItemStrategy;
      economy: EconomyStrategy;
    }
  ) {}

  // 每个准备阶段调用
  async makeDecisions(state: MatchState): Promise<Command[]> {
    const commands: Command[] = [];

    // 1. 经济决策（升级/刷新）
    const economyCommands = this.strategies.economy.decide(state);
    commands.push(...economyCommands);

    // 2. 购买决策
    const buyCommands = this.strategies.buy.decide(state);
    commands.push(...buyCommands);

    // 3. 装备决策
    const itemCommands = this.strategies.item.decide(state);
    commands.push(...itemCommands);

    // 4. 站位决策
    const positionCommands = this.strategies.position.decide(state);
    commands.push(...positionCommands);

    return commands;
  }
}
```

#### 简单策略示例

**BuyStrategy (购买):**
```typescript
export class SimpleBuyStrategy implements BuyStrategy {
  decide(state: MatchState): Command[] {
    const commands: Command[] = [];
    const { shop, gold, preparation } = state;

    // 优先级：
    // 1. 能升星的英雄（2星→3星）
    for (const slot of shop.slots) {
      if (slot.status !== 'available') continue;
      const canUpgrade = this.canUpgradeWith(slot.definitionId, preparation);
      if (canUpgrade && gold >= this.getCost(slot.definitionId)) {
        commands.push({ action: 'buyUnit', params: { slot: index } });
      }
    }

    // 2. 高费卡（4费+）
    // 3. 强势英雄
    // ...

    return commands;
  }
}
```

**PositionStrategy (站位):**
```typescript
export class SimplePositionStrategy implements PositionStrategy {
  decide(state: MatchState): Command[] {
    const commands: Command[] = [];
    const { preparation } = state;

    // 简单规则：
    // - 坦克（高HP）前排 (row 0-1)
    // - 输出后排 (row 2-3)
    for (const unit of preparation.units) {
      const isTank = this.isTank(unit);
      const targetRow = isTank ? 0 : 3;
      const targetCol = this.findEmptyCol(preparation.board, targetRow);

      if (targetCol !== null) {
        commands.push({
          action: 'deploy',
          params: { unitId: unit.id, location: { row: targetRow, col: targetCol } }
        });
      }
    }

    return commands;
  }
}
```

### 2.3 匹配系统

#### 配对算法
```typescript
// server/room/MatchmakingService.ts
export class MatchmakingService {
  // TFT标准配对算法
  generateMatchups(players: Player[], round: number): Matchup[] {
    const alive = players.filter(p => !p.isEliminated);

    // 第1轮：随机配对
    if (round === 1) {
      return this.randomPairing(alive);
    }

    // 后续轮次：避免重复对手，优先同分段
    return this.smartPairing(alive, round);
  }

  private smartPairing(players: Player[], round: number): Matchup[] {
    // 1. 按HP排序
    const sorted = [...players].sort((a, b) => b.hp - a.hp);

    // 2. 相邻配对（HP接近的互打）
    const matchups: Matchup[] = [];
    for (let i = 0; i < sorted.length; i += 2) {
      if (i + 1 < sorted.length) {
        matchups.push({
          round,
          player1Id: sorted[i].id,
          player2Id: sorted[i + 1].id,
          result: null
        });
      } else {
        // 奇数玩家：轮空或对战克隆体
        matchups.push({
          round,
          player1Id: sorted[i].id,
          player2Id: this.getClone(sorted[i]),
          result: null
        });
      }
    }

    return matchups;
  }
}
```

### 2.4 房间生命周期

```typescript
// server/room/Room.ts
export class Room {
  private phase: 'waiting' | 'preparation' | 'combat' | 'settlement' | 'finished';

  async start() {
    // 1. 检查人数，填充AI
    this.fillBots();

    // 2. 初始化所有玩家的MatchState
    for (const player of this.players) {
      player.state = createMatch(); // 复用simulation/match.ts
    }

    // 3. 广播游戏开始
    this.broadcast({ type: 'gameStart', initialStates: this.getAllStates() });

    // 4. 开始第一轮
    await this.startRound(1);
  }

  async startRound(round: number) {
    this.phase = 'preparation';

    // 1. 生成配对
    const matchups = this.matchmakingService.generateMatchups(this.players, round);
    this.broadcast({ type: 'roundStart', round, matchups });

    // 2. 准备阶段（30秒）
    await this.preparationPhase(30);

    // 3. 战斗阶段
    await this.combatPhase(matchups);

    // 4. 结算
    await this.settlementPhase();

    // 5. 检查游戏是否结束
    if (this.getAlivePlayers().length <= 1) {
      await this.endGame();
    } else {
      await this.startRound(round + 1);
    }
  }

  private async preparationPhase(seconds: number) {
    const deadline = Date.now() + seconds * 1000;

    // AI玩家自动操作
    for (const player of this.players) {
      if (player.type === 'bot') {
        const commands = await (player as BotPlayer).makeDecisions();
        for (const cmd of commands) {
          this.executeCommand(player.id, cmd);
        }
      }
    }

    // 等待倒计时或所有玩家ready
    while (Date.now() < deadline && !this.allReady()) {
      await sleep(100);
    }
  }

  private async combatPhase(matchups: Matchup[]) {
    this.phase = 'combat';

    // 并行计算所有战斗
    const results = await Promise.all(
      matchups.map(m => this.simulateCombat(m))
    );

    // 广播战斗结果
    this.broadcast({ type: 'combatEnd', results });
  }

  private async simulateCombat(matchup: Matchup): Promise<CombatSummary> {
    const p1 = this.getPlayer(matchup.player1Id);
    const p2 = this.getPlayer(matchup.player2Id);

    // 启动战斗（复用simulation/match.ts）
    const result1 = startMatchCombat(p1.state);
    const result2 = startMatchCombat(p2.state);

    if (!result1.ok || !result2.ok) {
      throw new Error('Combat start failed');
    }

    // Tick直到结束
    while (result1.state.phase === 'combat') {
      const step1 = stepMatch(result1.state);
      const step2 = stepMatch(result2.state);
      // ... 同步tick
    }

    // 计算伤害
    const damage = this.calculateDamage(result1.state.combat.result);

    return {
      player1Id: p1.id,
      player2Id: p2.id,
      result: result1.state.combat.result,
      damageDealt: damage
    };
  }
}
```

### 2.5 客户端改造

#### 移除模块
```
删除：
src/simulation/     (移到服务端)
src/persistence/    (改用服务端存档)
```

#### 新增模块
```
src/multiplayer/
├─ connection/
│  ├─ WebSocketClient.ts    # WS连接管理
│  └─ reconnection.ts        # 断线重连
├─ state/
│  ├─ RemoteMatchState.ts    # 远程状态代理
│  └─ sync.ts                # 状态同步
├─ commands/
│  └─ CommandSender.ts       # 命令发送队列
└─ ui/
   ├─ LobbyScene.ts          # 大厅界面
   ├─ RoomScene.ts           # 房间界面
   └─ SpectatorView.ts       # 观战视角
```

#### 关键改造点

**原match-session.ts改造：**
```typescript
// 原来：本地执行命令
class MatchSession {
  buy(slot: number) {
    const result = buyUnit(this.state, slot);  // 本地计算
    this.state = result.state;
  }
}

// 改造后：发送到服务端
class RemoteMatchSession {
  constructor(private ws: WebSocketClient) {}

  buy(slot: number) {
    // 发送命令到服务端
    this.ws.send({
      type: 'command',
      action: 'buyUnit',
      params: { slot }
    });

    // 等待服务端返回状态更新
    // (通过事件监听处理)
  }

  // 监听服务端状态
  onStateUpdate(handler: (state: MatchState) => void) {
    this.ws.on('stateUpdate', (msg) => {
      handler(msg.state);
    });
  }
}
```

---

## 三、开发计划

### 阶段1：基础框架（第1周）

**服务端：**
1. 搭建WebSocket服务（ws库）
2. 实现RoomManager基础功能
3. 实现命令验证和执行
4. 复制simulation/到服务端

**客户端：**
1. 实现WebSocketClient
2. 改造match-session为RemoteMatchSession
3. 实现基础大厅界面

**里程碑：** 2个真人能创建房间并连接

### 阶段2：8人对战（第2周）

**服务端：**
1. 实现MatchmakingService
2. 实现并行战斗计算
3. 实现淘汰和排名系统

**客户端：**
1. 实现房间玩家列表UI
2. 实现战斗结果展示
3. 实现排名界面

**里程碑：** 2-4个真人能完整对战

### 阶段3：AI机器人（第3-4周）

**服务端：**
1. 实现SimpleBuyStrategy
2. 实现SimplePositionStrategy
3. 实现ItemStrategy和EconomyStrategy
4. BotPlayer集成

**客户端：**
1. 机器人标识UI
2. 难度选择界面

**里程碑：** 1真人+7AI能完整对局

### 阶段4：优化完善（第5-6周）

**功能：**
1. 观战系统
2. 断线重连
3. 延迟优化
4. AI优化

**测试：**
1. 压力测试
2. 作弊测试
3. 用户体验测试

---

## 四、技术栈

### 服务端
```json
{
  "runtime": "Node.js 22+ 或 Bun",
  "dependencies": {
    "ws": "^8.14.0",           // WebSocket
    "uuid": "^9.0.0",          // ID生成
    "zod": "^3.22.0"           // 运行时验证
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/ws": "^8.5.0"
  }
}
```

### 客户端
```json
{
  "新增dependencies": {
    // 无需新增，浏览器原生WebSocket
  }
}
```

### 部署
- 服务端：Docker + PM2
- Nginx反向代理（WebSocket支持）
- 数据库：SQLite（开发）/ PostgreSQL（生产）

---

## 五、性能考虑

### 服务端优化
1. **并行战斗计算**：8场战斗同时计算
2. **状态diff广播**：只发送变化部分
3. **事件压缩**：合并小事件

### 网络优化
1. **预测回滚**：客户端预执行，服务端校正
2. **增量同步**：只发送状态diff
3. **Binary协议**：可选，MessagePack替代JSON

### 资源预算（4核8G服务器）
- 单房间（8人）：~200MB内存
- 可支持：30-40个并发房间
- 每房间1个Node进程或worker

---

## 六、安全考虑

### 防作弊
1. **服务端权威**：所有计算在服务端
2. **命令验证**：检查gold/shop generation等
3. **时间窗口**：准备阶段超时自动开始

### 输入验证
```typescript
// 示例：购买验证
function validateBuyCommand(state: MatchState, slot: number): boolean {
  if (state.phase !== 'preparation') return false;
  if (slot < 0 || slot >= state.shop.slots.length) return false;
  const shopSlot = state.shop.slots[slot];
  if (shopSlot.status !== 'available') return false;
  const cost = UNIT_DEFINITIONS[shopSlot.definitionId].cost;
  if (state.gold < cost) return false;
  return true;
}
```

---

## 七、后续扩展

### 短期（M8多人完成后）
- [ ] 排行榜系统
- [ ] 战绩记录
- [ ] 回放分享
- [ ] 聊天系统

### 长期
- [ ] 匹配队列（自动匹配）
- [ ] 段位系统
- [ ] 赛季机制
- [ ] 移动端适配

---

## 八、风险评估

| 风险 | 影响 | 应对 |
|------|------|------|
| AI过弱/过强 | 用户体验差 | 多轮测试调参，难度分级 |
| 网络延迟 | 操作卡顿 | 客户端预测+服务端校正 |
| 服务器崩溃 | 游戏中断 | 自动重启+状态持久化 |
| 9v9性能问题 | 可能影响8人 | 先测试2人→4人→8人，逐步优化 |

---

## 附录：给GPT的实施清单

见下一个文档：`IMPLEMENTATION_GUIDE.md`
