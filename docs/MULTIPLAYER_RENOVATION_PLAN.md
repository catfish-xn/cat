# Set13 多人联网改造整体规划

## 项目概述

**当前状态：** 单人本地TFT游戏，M8 B10分支功能完成但未合并  
**目标状态：** 8人在线对战，支持AI机器人填充  
**服务器规格：** 4核8G（小规模，3-4好友）  
**预计工期：** 6-8周

---

## 阶段划分

### 阶段0：准备工作（1-2天）
**负责：Claude规划 + GPT执行**

#### 0.1 合并M8 B10到main
```bash
# 检查状态
cd /c/Users/Administrator/Desktop/set13
git checkout main
git pull origin main

# 创建合并分支
git checkout -b merge-m8-b10
git merge origin/feat/m8-b10 --no-ff

# 如果有冲突
git status  # 查看冲突文件
# 手动解决冲突后
git add .
git commit -m "Merge M8 B10 to main"

# 推送
git push origin merge-m8-b10

# 创建PR（使用gh cli）
gh pr create \
  --title "Merge M8 B10: Complete 44 items + Stage 1" \
  --body "Complete M8 implementation, ready for multiplayer conversion.

## Included
- 44 equipment items (8 components + 36 completed)
- Stage 1-6 schedule (38 rounds, 33 battles)
- Save/replay v2
- UI integration U1-U7

## Known Issues
- 9v9 performance (will address in multiplayer phase)
- 28 items need icons
- Temporary translations

🤖 Generated with [Claude Code](https://claude.com/claude-code)"

# 合并到main
git checkout main
git merge merge-m8-b10
git push origin main
```

**验收标准：**
- [ ] M8 B10成功合并到main
- [ ] CI通过（如果有）
- [ ] 本地`npm run dev`正常运行
- [ ] 可以玩到6-7结束

#### 0.2 代码质量检查
```bash
# 运行测试
npm test

# 检查TypeScript错误
npx tsc --noEmit

# 检查装备数量
grep -c '"id":' src/simulation/content/items.ts
# 应该输出44（或更多，包括嵌套的values对象）

# 验证基础功能
npm run dev
# 手动游玩测试：购买、装备、战斗、回放
```

**验收标准：**
- [ ] 测试通过或已知失败被记录
- [ ] TypeScript无致命错误
- [ ] 装备系统可用
- [ ] 战斗系统正常

#### 0.3 创建项目分支
```bash
# 创建多人改造主分支
git checkout -b feat/multiplayer-base

# 推送
git push origin feat/multiplayer-base
```

---

### 阶段1：服务端框架（第1周，5-7天）
**目标：** 2个真人能创建房间并看到彼此  
**负责：** GPT主要实现，Claude审查

#### 1.1 项目结构搭建（半天）

**创建目录：**
```bash
cd /c/Users/Administrator/Desktop/set13

# 服务端目录
mkdir -p server/src/{types,room,ai,sync,utils}
mkdir -p server/src/simulation

# 客户端目录
mkdir -p src/multiplayer/{connection,state,commands,ui}
```

**服务端package.json：**
```bash
cd server

cat > package.json << 'EOF'
{
  "name": "set13-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "ws": "^8.18.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.7.0",
    "vitest": "^1.6.0"
  }
}
EOF

npm install
```

**tsconfig.json：**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  }
}
```

**验收：**
```bash
cd server
npm run build  # 应该成功（即使没有src文件）
```

#### 1.2 通信协议定义（1天）

**文件：** `server/src/types/protocol.ts`

关键类型：
```typescript
// 房间
interface Room {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  round: number;
  settings: RoomSettings;
}

// 玩家
interface Player {
  id: string;
  name: string;
  type: 'human' | 'bot';
  isReady: boolean;
  hp: number;
  isEliminated: boolean;
}

// 消息协议
type ClientMessage =
  | { type: 'createRoom'; playerName: string }
  | { type: 'joinRoom'; roomId: string; playerName: string }
  | { type: 'ready' }
  | { type: 'command'; action: string; params: any };

type ServerMessage =
  | { type: 'roomCreated'; roomId: string }
  | { type: 'roomJoined'; room: RoomSnapshot }
  | { type: 'gameStart' }
  | { type: 'stateUpdate'; playerId: string; state: any }
  | { type: 'error'; message: string };
```

**实施步骤：**
1. 复制`IMPLEMENTATION_PHASE1.md`中的`protocol.ts`完整代码
2. 从客户端复制`MatchState`等类型导入
3. 确保TypeScript编译通过

**验收：**
```bash
cd server
npx tsc --noEmit  # 无错误
```

#### 1.3 WebSocket服务器（1天）

**文件：** `server/src/index.ts`

核心功能：
- WebSocket服务器监听3001端口
- 连接管理（connect/disconnect）
- 消息解析和路由
- 错误处理

**实施步骤：**
1. 复制`IMPLEMENTATION_PHASE1.md`中的`index.ts`代码
2. 创建`handlers.ts`处理消息路由
3. 测试连接

**测试命令：**
```bash
cd server
npm run dev

# 另一个终端
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3001');
ws.on('open', () => {
  console.log('Connected!');
  ws.close();
});
"
```

**验收：**
- [ ] 服务器启动输出`WebSocket server running on ws://localhost:3001`
- [ ] 测试连接成功输出`Connected!`
- [ ] 服务器日志显示`Client connected`

#### 1.4 房间管理系统（1.5天）

**文件：** `server/src/room/RoomManager.ts`

核心方法：
```typescript
class RoomManager {
  createRoom(playerId, playerName, settings): Room
  joinRoom(roomId, playerId, playerName): Room
  removePlayer(playerId): void
  setPlayerReady(playerId, ready): Room
  allPlayersReady(roomId): boolean
  startGame(roomId): void
}
```

**实施步骤：**
1. 复制`IMPLEMENTATION_PHASE1.md`中的`RoomManager.ts`
2. 实现房间生命周期管理
3. 添加日志记录

**测试：**
```bash
# 创建测试文件 server/src/room/RoomManager.test.ts
npm run test
```

**验收：**
- [ ] 能创建房间并返回roomId
- [ ] 能加入房间
- [ ] 人数限制生效（最多8人）
- [ ] Ready状态正确更新
- [ ] 所有人ready后能触发startGame

#### 1.5 客户端WebSocket连接（1天）

**文件：** 
- `src/multiplayer/connection/WebSocketClient.ts`
- `src/multiplayer/connection/ConnectionManager.ts`

核心功能：
- 连接到服务器
- 消息发送/接收
- 断线重连
- 事件监听器

**实施步骤：**
1. 复制`IMPLEMENTATION_PHASE1.md`中的客户端连接代码
2. 配置环境变量（`.env.development`）
3. 测试连接

**环境变量：**
```bash
# .env.development
VITE_WS_URL=ws://localhost:3001
```

**测试：**
```typescript
// 在浏览器console测试
import { connectionManager } from './multiplayer/connection/ConnectionManager';

const client = await connectionManager.connect();
console.log('Connected:', client.connected);
```

**验收：**
- [ ] 浏览器能连接到服务器
- [ ] 服务器收到连接日志
- [ ] 能发送和接收消息
- [ ] 断线后自动重连

#### 1.6 大厅和房间UI（2天）

**文件：**
- `src/multiplayer/ui/LobbyScene.ts`
- `src/multiplayer/ui/RoomScene.ts`

**LobbyScene功能：**
- 创建房间按钮
- 加入房间输入框
- 连接状态显示

**RoomScene功能：**
- 显示房间ID
- 玩家列表（实时更新）
- Ready按钮
- 离开房间按钮

**实施步骤：**
1. 复制`IMPLEMENTATION_PHASE1.md`中的UI代码
2. 在`src/main.ts`注册Scene
3. 修改启动逻辑，先进入LobbyScene

**main.ts修改：**
```typescript
import { LobbyScene } from './multiplayer/ui/LobbyScene';
import { RoomScene } from './multiplayer/ui/RoomScene';

// Phaser配置
scene: [
  LobbyScene,   // 新增：大厅
  RoomScene,    // 新增：房间
  // ... 其他scene
]
```

**验收：**
- [ ] 启动游戏显示大厅界面
- [ ] 创建房间后显示房间ID
- [ ] 第二个客户端能加入
- [ ] 玩家列表实时更新
- [ ] Ready状态同步显示

#### 1.7 端到端测试（半天）

**测试场景：**

**场景1：创建和加入**
```
1. 启动服务器：cd server && npm run dev
2. 启动客户端1：npm run dev（浏览器1）
3. 点击"Create Room"，输入"Alice"
4. 复制房间ID
5. 打开浏览器2（无痕模式）
6. 点击"Join Room"，粘贴ID，输入"Bob"
7. 验证：两边都能看到对方
```

**场景2：Ready同步**
```
1. Alice点击"Ready"
2. 验证：Bob看到Alice变绿✓
3. Bob点击"Ready"
4. 验证：控制台显示"Game starting!"
```

**场景3：离开房间**
```
1. Alice点击"Leave Room"
2. 验证：Bob看到Alice消失
3. 服务器日志显示玩家离开
```

**记录问题：**
```bash
# 创建测试报告
cat > docs/PHASE1_TEST_REPORT.md << 'EOF'
# 阶段1测试报告

## 测试环境
- 服务端：Node.js 22
- 客户端：Chrome 120
- 网络：本地localhost

## 测试结果
- [ ] 场景1：创建和加入
- [ ] 场景2：Ready同步
- [ ] 场景3：离开房间

## 发现的问题
1. ...
2. ...

## 修复记录
1. ...
EOF
```

**验收标准：**
- [ ] 所有测试场景通过
- [ ] 无致命错误
- [ ] 网络断开能正确处理
- [ ] 多次创建/加入/离开稳定

#### 1.8 代码提交

```bash
# 提交阶段1代码
git add server/ src/multiplayer/ .env.development
git commit -m "feat: Phase 1 - Basic multiplayer framework

- WebSocket server with room management
- Client connection layer
- Lobby and room UI
- 2-player room creation and joining working

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"

git push origin feat/multiplayer-base
```

---

### 阶段2：游戏状态同步（第2周，5-7天）
**目标：** 2个真人能完整对战（1v1）  
**负责：** GPT主要实现

#### 2.1 复制simulation到服务端（1天）

**步骤：**
```bash
# 复制整个simulation目录
cp -r src/simulation server/src/

# 验证可以导入
cat > server/src/test-import.ts << 'EOF'
import { createMatch, buyUnit } from './simulation/match.js';

const match = createMatch();
console.log('Match created:', match.round);
EOF

cd server
npx tsx src/test-import.ts
# 应该输出：Match created: 1
```

**修复导入路径：**
```typescript
// 所有 import from '../xxx' 改为 import from './xxx'
// 使用查找替换
find server/src/simulation -name "*.ts" -exec sed -i 's/from "\.\.\/\//from ".\//g' {} \;
```

**验收：**
- [ ] simulation目录完整复制
- [ ] TypeScript编译无错误
- [ ] 能创建Match并执行命令

#### 2.2 命令处理器（1天）

**文件：** `server/src/room/CommandExecutor.ts`

```typescript
export class CommandExecutor {
  // 验证命令合法性
  validateCommand(state: MatchState, cmd: Command): boolean {
    switch (cmd.action) {
      case 'buyUnit':
        return this.validateBuyUnit(state, cmd.params);
      case 'deploy':
        return this.validateDeploy(state, cmd.params);
      // ...
    }
  }

  // 执行命令
  executeCommand(state: MatchState, cmd: Command): MatchCommandResult {
    switch (cmd.action) {
      case 'buyUnit':
        return buyUnit(state, cmd.params.slot, cmd.params.generation);
      case 'sellUnit':
        return sellUnit(state, cmd.params.unitId);
      // ...
    }
  }
}
```

**实施步骤：**
1. 为每个命令类型实现验证
2. 调用simulation中的函数执行
3. 返回结果或错误

**测试：**
```typescript
// server/src/room/CommandExecutor.test.ts
describe('CommandExecutor', () => {
  it('should execute valid buyUnit command', () => {
    const executor = new CommandExecutor();
    const state = createMatch();
    const cmd = { action: 'buyUnit', params: { slot: 0, generation: 1 } };
    
    const result = executor.executeCommand(state, cmd);
    expect(result.ok).toBe(true);
  });

  it('should reject invalid buyUnit', () => {
    // 金币不足
    const state = { ...createMatch(), gold: 0 };
    const cmd = { action: 'buyUnit', params: { slot: 0, generation: 1 } };
    
    const result = executor.executeCommand(state, cmd);
    expect(result.ok).toBe(false);
  });
});
```

**验收：**
- [ ] 所有命令类型有验证
- [ ] 非法命令被拒绝
- [ ] 合法命令正确执行
- [ ] 测试覆盖率>80%

#### 2.3 游戏循环（1.5天）

**文件：** `server/src/room/GameLoop.ts`

```typescript
export class GameLoop {
  private room: Room;
  private phase: 'preparation' | 'combat' | 'settlement';
  private timer: NodeJS.Timeout | null = null;

  async startRound(round: number) {
    this.phase = 'preparation';
    
    // 广播回合开始
    this.broadcast({ type: 'roundStart', round });

    // 准备阶段（30秒）
    await this.preparationPhase(30);

    // 战斗阶段
    await this.combatPhase();

    // 结算阶段
    await this.settlementPhase();

    // 下一轮或结束
    if (this.shouldContinue()) {
      await this.startRound(round + 1);
    } else {
      this.endGame();
    }
  }

  private async preparationPhase(seconds: number) {
    const deadline = Date.now() + seconds * 1000;

    // 倒计时
    while (Date.now() < deadline) {
      await sleep(1000);
      const remaining = Math.ceil((deadline - Date.now()) / 1000);
      this.broadcast({ type: 'prepTimer', seconds: remaining });
    }
  }

  private async combatPhase() {
    // TODO: Phase 2 - 计算战斗
  }
}
```

**实施步骤：**
1. 实现准备阶段倒计时
2. 实现战斗阶段（先做1v1简化版）
3. 实现结算（HP扣除）

**验收：**
- [ ] 回合正确开始
- [ ] 倒计时广播
- [ ] 战斗能计算出结果
- [ ] HP正确扣除

#### 2.4 战斗计算（2天）

**简化1v1战斗：**
```typescript
async function simulateCombat(
  player1State: MatchState,
  player2State: MatchState
): Promise<CombatResult> {
  // 1. 启动两边的战斗
  const combat1 = startMatchCombat(player1State);
  const combat2 = startMatchCombat(player2State);

  if (!combat1.ok || !combat2.ok) {
    throw new Error('Combat start failed');
  }

  // 2. Tick直到一方结束
  let state1 = combat1.state;
  let state2 = combat2.state;
  const events1: CombatEvent[] = [];
  const events2: CombatEvent[] = [];

  while (state1.phase === 'combat' && state2.phase === 'combat') {
    const step1 = stepMatch(state1);
    const step2 = stepMatch(state2);

    state1 = step1.state;
    state2 = step2.state;
    events1.push(...step1.events);
    events2.push(...step2.events);

    // 防止死循环
    if (events1.length > 100000) {
      throw new Error('Combat timeout');
    }
  }

  // 3. 判断胜负
  const result1 = state1.combat!.result;
  const result2 = state2.combat!.result;

  return {
    player1Result: result1,
    player2Result: result2,
    events: { player1: events1, player2: events2 }
  };
}
```

**实施步骤：**
1. 实现并行战斗计算
2. 添加超时保护
3. 记录所有事件
4. 广播战斗结果

**性能优化：**
```typescript
// 不需要每个tick都广播
// 只在战斗结束时发送完整事件列表
const result = await simulateCombat(p1, p2);
this.broadcast({
  type: 'combatEnd',
  player1Id: p1.id,
  player2Id: p2.id,
  events: result.events
});
```

**验收：**
- [ ] 1v1战斗能完整计算
- [ ] 事件记录完整
- [ ] 无死循环
- [ ] 性能可接受（<5秒）

#### 2.5 客户端状态同步（1天）

**文件：** `src/multiplayer/state/RemoteMatchSession.ts`

```typescript
export class RemoteMatchSession {
  private state: MatchState;
  private client: WebSocketClient;
  private listeners = new Set<StateListener>();

  constructor(client: WebSocketClient, initialState: MatchState) {
    this.client = client;
    this.state = initialState;

    // 监听服务端状态更新
    this.client.on('stateUpdate', (msg) => {
      if (msg.type === 'stateUpdate') {
        this.updateState(msg.state, msg.events);
      }
    });
  }

  // 发送命令到服务端
  buyUnit(slot: number, generation: number) {
    this.client.send({
      type: 'command',
      action: 'buyUnit',
      params: { slot, generation }
    });
  }

  // 其他命令...

  // 状态更新通知
  private updateState(newState: MatchState, events: MatchEvent[]) {
    const oldState = this.state;
    this.state = newState;

    for (const listener of this.listeners) {
      listener({ before: oldState, after: newState, events });
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get currentState(): MatchState {
    return this.state;
  }
}
```

**实施步骤：**
1. 创建RemoteMatchSession替代本地MatchSession
2. 所有命令改为发送到服务端
3. 监听服务端状态更新
4. 通知UI层重新渲染

**UI集成：**
```typescript
// 修改现有的游戏Scene
// 原来：
const session = new MatchSession();

// 改为：
const session = new RemoteMatchSession(client, initialState);
```

**验收：**
- [ ] 购买命令能发送到服务端
- [ ] 服务端返回的状态能更新UI
- [ ] 两个客户端看到的状态一致
- [ ] 延迟可接受（<100ms本地）

#### 2.6 完整1v1测试（半天）

**测试场景：完整对局**
```
1. Alice和Bob创建房间，都ready
2. 回合1：
   - Alice买英雄，部署
   - Bob买英雄，部署
   - 倒计时结束
   - 战斗自动计算
   - 看到战斗结果
   - HP扣除
3. 回合2：
   - 继续购买和部署
   - 重复战斗
4. 一方HP归0
   - 显示胜负
```

**记录问题：**
```bash
cat > docs/PHASE2_TEST_REPORT.md << 'EOF'
# 阶段2测试报告

## 测试场景
- [ ] 完整1v1对局（10回合）
- [ ] 快速操作（spam命令）
- [ ] 网络延迟（throttle）
- [ ] 断线重连（关闭再打开）

## 性能指标
- 命令响应时间：__ ms
- 战斗计算时间：__ ms
- 状态同步延迟：__ ms

## 发现的问题
1. ...
EOF
```

**验收标准：**
- [ ] 能完整玩完一局1v1
- [ ] 战斗结果正确
- [ ] 状态同步无错乱
- [ ] 无卡死或崩溃

#### 2.7 提交代码

```bash
git add server/ src/
git commit -m "feat: Phase 2 - Game state synchronization

- Copy simulation to server
- Command executor and validator
- Combat calculation (1v1)
- Client state synchronization
- Full 1v1 match working

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"

git push origin feat/multiplayer-base
```

---

### 阶段3：AI机器人（第3-4周，10-15天）
**目标：** 1真人 + 7AI能完整对局  
**负责：** GPT主要实现，Claude设计策略

#### 3.1 AI框架搭建（1天）

**文件：** `server/src/ai/BotPlayer.ts`

```typescript
export class BotPlayer {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  state: MatchState;
  private engine: DecisionEngine;

  constructor(name: string, difficulty: 'easy' | 'medium' | 'hard') {
    this.id = uuidv4();
    this.name = name;
    this.difficulty = difficulty;
    this.state = createMatch();
    this.engine = createDecisionEngine(difficulty);
  }

  async makeDecisions(): Promise<Command[]> {
    return this.engine.makeDecisions(this.state);
  }
}
```

**实施步骤：**
1. 创建BotPlayer类
2. 实现DecisionEngine接口
3. 集成到RoomManager（自动填充）

**验收：**
- [ ] 能创建AI玩家
- [ ] AI能加入房间
- [ ] AI显示在玩家列表

#### 3.2 Easy难度AI（2-3天）

参考`AI_STRATEGY_DESIGN.md`的Easy实现

**EasyBuyStrategy：**
```typescript
class EasyBuyStrategy {
  decide(state: MatchState): Command[] {
    const commands: Command[] = [];
    const { shop, gold } = state;

    // 随机购买能买得起的
    for (let i = 0; i < shop.slots.length; i++) {
      const slot = shop.slots[i];
      if (slot.status !== 'available') continue;

      const cost = UNIT_DEFINITIONS[slot.definitionId].cost;
      if (gold >= cost && Math.random() < 0.5) {
        commands.push({ action: 'buyUnit', params: { slot: i } });
        gold -= cost;
      }
    }

    return commands;
  }
}
```

**EasyPositionStrategy：**
```typescript
class EasyPositionStrategy {
  decide(state: MatchState): Command[] {
    const commands: Command[] = [];
    const bench = getBenchUnits(state.preparation);

    // 随机部署到空位
    bench.forEach(unit => {
      const pos = findEmptyPosition(state.preparation.board);
      if (pos) {
        commands.push({
          action: 'deploy',
          params: { unitId: unit.id, location: pos }
        });
      }
    });

    return commands;
  }
}
```

**EasyEconomyStrategy：**
```typescript
class EasyEconomyStrategy {
  decide(state: MatchState): Command[] {
    // 金币>50就升级
    if (state.gold >= 50 && state.level < 9) {
      return [{ action: 'buyXp', params: {} }];
    }
    return [];
  }
}
```

**实施步骤：**
1. 实现三个Easy策略
2. 组合成EasyDecisionEngine
3. 测试AI能完成游戏

**测试：**
```bash
# 单元测试
npm run test -- ai/strategies/

# 集成测试：1真人 + 1 Easy AI
# 手动验证AI的行为
```

**验收：**
- [ ] AI能购买英雄
- [ ] AI能部署英雄
- [ ] AI能完成一局游戏
- [ ] AI不会卡死或报错

#### 3.3 Medium难度AI（4-5天）

参考`AI_STRATEGY_DESIGN.md`的Medium实现

**MediumBuyStrategy：**
- 优先购买能升星的
- 高费卡优先
- 职业协同考虑

**MediumPositionStrategy：**
- 坦克前排，输出后排
- HP阈值判断

**MediumEconomyStrategy：**
- 利息管理
- 升级时机
- 刷新决策

**MediumItemStrategy：**
- 自动合成
- 装备分配（AD/AP/坦克）

**实施步骤：**
1. 实现优先级系统（购买）
2. 实现前后排站位
3. 实现装备合成和分配
4. 实现经济管理
5. 调参测试

**测试：**
```bash
# 测试AI vs AI
# 10局Medium vs Medium
npm run test:ai-battle

# 测试真人 vs Medium
# 手动验证AI强度
```

**验收：**
- [ ] AI能升星
- [ ] AI站位合理
- [ ] AI能合成装备
- [ ] AI经济管理有效
- [ ] AI强度适中（不太弱也不太强）

#### 3.4 Bot填充系统（1天）

**文件：** `server/src/room/BotManager.ts`

```typescript
export class BotManager {
  fillBots(room: Room): void {
    if (!room.settings.botFillEnabled) return;

    const humanCount = room.players.filter(p => p.type === 'human').length;
    const botCount = room.settings.maxPlayers - humanCount;

    for (let i = 0; i < botCount; i++) {
      const bot = new BotPlayer(
        `Bot ${i + 1}`,
        room.settings.botDifficulty
      );

      room.players.push({
        id: bot.id,
        name: bot.name,
        type: 'bot',
        isReady: true,
        hp: 100,
        isEliminated: false,
        rank: null
      });
    }
  }

  async runBotsDecisions(room: Room): Promise<void> {
    const bots = room.players.filter(p => p.type === 'bot');

    for (const botPlayer of bots) {
      const bot = this.getBotInstance(botPlayer.id);
      const commands = await bot.makeDecisions();

      for (const cmd of commands) {
        const result = executeCommand(botPlayer.state, cmd);
        if (result.ok) {
          botPlayer.state = result.state;
        }
      }
    }
  }
}
```

**实施步骤：**
1. 游戏开始时自动填充AI
2. 准备阶段AI自动决策
3. AI状态也要同步广播

**验收：**
- [ ] 1人房间自动填充7个AI
- [ ] AI自动ready
- [ ] 游戏正常开始
- [ ] AI正常参与游戏

#### 3.5 Hard难度AI（可选，3-5天）

如果时间充足，实现Hard难度：
- 阵容理解（识别当前在玩什么阵容）
- 对手观察（看对手在玩什么）
- 灵活调整（根据情况切换策略）

**实施步骤：**
1. 定义几个常见阵容
2. 实现阵容识别
3. 实现针对性策略
4. 大量测试调参

**验收：**
- [ ] AI能识别自己的阵容
- [ ] AI能根据阵容调整策略
- [ ] AI强度接近普通玩家

#### 3.6 AI压力测试（1天）

**测试场景：**
```bash
# 8个AI互相对战
# 测试100局
npm run test:ai-stress

# 记录：
# - 平均游戏时长
# - 服务器CPU/内存
# - 是否有卡死
# - 是否有异常行为
```

**性能指标：**
- 单局时长：<10分钟
- 服务器CPU：<80%
- 内存：<2GB
- 无崩溃

**验收标准：**
- [ ] 100局无崩溃
- [ ] 性能指标达标
- [ ] AI行为合理
- [ ] 无明显bug

#### 3.7 提交代码

```bash
git add server/src/ai/
git commit -m "feat: Phase 3 - AI bot system

- Bot player framework
- Easy difficulty (random)
- Medium difficulty (strategy-based)
- Auto bot filling
- 1 human + 7 bots working

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"

git push origin feat/multiplayer-base
```

---

### 阶段4：8人对战系统（第5周，5-7天）
**目标：** 完整的8人淘汰赛  
**负责：** GPT主要实现

#### 4.1 匹配系统（1.5天）

**文件：** `server/src/room/MatchmakingService.ts`

```typescript
export class MatchmakingService {
  generateMatchups(players: Player[], round: number): Matchup[] {
    const alive = players.filter(p => !p.isEliminated);

    if (round === 1) {
      return this.randomPairing(alive);
    }

    // 按HP排序，相邻配对
    return this.rankBasedPairing(alive);
  }

  private rankBasedPairing(players: Player[]): Matchup[] {
    const sorted = [...players].sort((a, b) => b.hp - a.hp);
    const matchups: Matchup[] = [];

    for (let i = 0; i < sorted.length; i += 2) {
      if (i + 1 < sorted.length) {
        matchups.push({
          player1Id: sorted[i].id,
          player2Id: sorted[i + 1].id,
          result: null
        });
      } else {
        // 奇数玩家：对战克隆体
        matchups.push({
          player1Id: sorted[i].id,
          player2Id: 'clone:' + this.getRandomAlivePlayer(sorted).id,
          result: null
        });
      }
    }

    return matchups;
  }
}
```

**实施步骤：**
1. 实现配对算法
2. 处理奇数玩家（克隆体或轮空）
3. 避免重复对手（可选）

**测试：**
```typescript
describe('MatchmakingService', () => {
  it('should pair 8 players into 4 matchups', () => {
    const players = createPlayers(8);
    const matchups = service.generateMatchups(players, 1);
    expect(matchups.length).toBe(4);
  });

  it('should handle odd number of players', () => {
    const players = createPlayers(7);
    const matchups = service.generateMatchups(players, 1);
    expect(matchups.length).toBe(4); // 3对战 + 1轮空/克隆
  });
});
```

**验收：**
- [ ] 8人正确配对为4场
- [ ] 奇数玩家有对手
- [ ] 高HP和高HP互打

#### 4.2 并行战斗计算（2天）

```typescript
async function runAllCombats(matchups: Matchup[], room: Room): Promise<CombatResult[]> {
  // 并行计算所有战斗
  const results = await Promise.all(
    matchups.map(m => simulateCombat(
      room.getPlayerState(m.player1Id),
      room.getPlayerState(m.player2Id)
    ))
  );

  return results;
}
```

**性能优化：**
- 使用Worker Pool（可选）
- 限制并发数（4核最多4并发）
- 超时保护

**实施步骤：**
1. 实现并行计算
2. 添加超时和错误处理
3. 压力测试

**测试：**
```bash
# 测试4场同时战斗
# 记录时间
npm run test:parallel-combat

# 预期：<10秒完成4场
```

**验收：**
- [ ] 4场战斗能同时计算
- [ ] 总耗时<10秒
- [ ] 无内存溢出
- [ ] 无竞态条件

#### 4.3 淘汰和排名系统（1天）

**文件：** `server/src/room/EliminationSystem.ts`

```typescript
export class EliminationSystem {
  updateHealthAndRanking(
    room: Room,
    combatResults: CombatResult[]
  ): void {
    for (const result of combatResults) {
      const player = room.getPlayer(result.playerId);
      
      if (result.outcome === 'defeat') {
        const damage = this.calculateDamage(result);
        player.hp -= damage;

        if (player.hp <= 0) {
          player.isEliminated = true;
          player.rank = this.getCurrentRank(room);
        }
      }
    }
  }

  private calculateDamage(result: CombatResult): number {
    // TFT标准伤害公式
    const baseDamage = result.stage + 2;
    const survivingUnits = result.enemySurvivingCount;
    return baseDamage + survivingUnits;
  }

  private getCurrentRank(room: Room): number {
    const eliminated = room.players.filter(p => p.isEliminated).length;
    return room.players.length - eliminated + 1;
  }
}
```

**实施步骤：**
1. 实现伤害计算
2. 实现HP扣除
3. 实现淘汰判定
4. 实现排名分配

**测试：**
```typescript
it('should eliminate player when HP <= 0', () => {
  player.hp = 5;
  system.updateHealth(player, { damage: 10 });
  
  expect(player.isEliminated).toBe(true);
  expect(player.rank).toBe(8); // 假设8人游戏
});
```

**验收：**
- [ ] 战败扣血正确
- [ ] HP归0触发淘汰
- [ ] 排名分配正确
- [ ] 最后1人胜利

#### 4.4 观战功能（1天）

**文件：** `src/multiplayer/ui/SpectatorView.ts`

```typescript
export class SpectatorView extends Phaser.Scene {
  private currentViewPlayerId: string;
  private allPlayersStates: Map<string, MatchState>;

  create() {
    // 玩家列表（点击切换视角）
    this.createPlayerList();

    // 当前观看的玩家状态
    this.createGameView();

    // 切换按钮
    this.createSwitchControls();
  }

  switchToPlayer(playerId: string) {
    this.currentViewPlayerId = playerId;
    this.updateGameView(this.allPlayersStates.get(playerId)!);
  }
}
```

**实施步骤：**
1. 服务端广播所有玩家状态
2. 客户端切换视角
3. 显示其他玩家的棋盘

**验收：**
- [ ] 能切换查看其他玩家
- [ ] 能看到其他玩家操作
- [ ] 淘汰后自动进入观战

#### 4.5 完整8人测试（1天）

**测试场景：8人完整对局**
```
1. 1真人 + 7 AI
2. 从回合1玩到最后
3. 记录每轮配对
4. 记录淘汰顺序
5. 验证排名正确
```

**记录数据：**
```bash
cat > docs/PHASE4_TEST_REPORT.md << 'EOF'
# 阶段4测试报告

## 8人对局测试

### 测试1：1人+7AI
- 总回合数：__
- 游戏时长：__ 分钟
- 淘汰顺序：8th, 7th, 6th, 5th, 4th, 3rd, 2nd, 1st
- 最终排名：__

### 性能数据
- 平均每回合时长：__ 秒
- 战斗计算时间：__ 秒
- 服务器CPU：__%
- 服务器内存：__ MB

### 发现的问题
1. ...
EOF
```

**验收标准：**
- [ ] 能完整玩完8人对局
- [ ] 淘汰顺序正确
- [ ] 排名分配正确
- [ ] 无卡死或崩溃
- [ ] 性能可接受

#### 4.6 提交代码

```bash
git add server/ src/
git commit -m "feat: Phase 4 - 8-player battle royale

- Matchmaking service
- Parallel combat calculation
- Elimination and ranking system
- Spectator mode
- Full 8-player game working

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"

git push origin feat/multiplayer-base
```

---

### 阶段5：优化和完善（第6-8周，可选）
**目标：** 生产就绪  
**负责：** GPT执行，Claude审查

#### 5.1 延迟优化（2-3天）

**客户端预测：**
```typescript
class PredictiveMatchSession {
  // 本地立即执行命令（乐观更新）
  buyUnit(slot: number) {
    // 预测执行
    const predictedResult = buyUnit(this.localState, slot);
    if (predictedResult.ok) {
      this.localState = predictedResult.state;
      this.renderState(this.localState);
    }

    // 发送到服务端
    this.client.send({ type: 'command', action: 'buyUnit', params: { slot } });
  }

  // 服务端确认后校正
  onServerStateUpdate(serverState: MatchState) {
    if (!this.isStateEqual(this.localState, serverState)) {
      console.warn('State mismatch, correcting');
      this.localState = serverState;
      this.renderState(serverState);
    }
  }
}
```

**验收：**
- [ ] 本地操作无延迟感
- [ ] 状态不一致时能校正
- [ ] 网络波动不影响体验

#### 5.2 断线重连（2-3天）

```typescript
class ReconnectionManager {
  async reconnect(playerId: string, roomId: string): Promise<void> {
    // 重新连接
    await this.client.connect();

    // 请求当前状态
    this.client.send({
      type: 'reconnect',
      playerId,
      roomId
    });

    // 服务端返回完整状态
    const state = await this.waitForState();
    this.restoreSession(state);
  }
}
```

**服务端：**
```typescript
// 保留断线玩家5分钟
setTimeout(() => {
  if (!player.reconnected) {
    room.eliminatePlayer(player.id);
  }
}, 5 * 60 * 1000);
```

**验收：**
- [ ] 断线后能重连
- [ ] 重连后状态正确
- [ ] 超时后自动淘汰

#### 5.3 数据持久化（2天）

**使用SQLite：**
```typescript
// server/src/db/schema.ts
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  created_at INTEGER,
  ended_at INTEGER,
  winner_id TEXT
);

CREATE TABLE game_players (
  game_id TEXT,
  player_id TEXT,
  player_name TEXT,
  rank INTEGER,
  final_hp INTEGER
);
```

**实施：**
1. 游戏结束时保存记录
2. 提供查询API
3. 排行榜

**验收：**
- [ ] 游戏记录能保存
- [ ] 能查询历史战绩
- [ ] 排行榜正常

#### 5.4 部署准备（2-3天）

**Docker化：**
```dockerfile
# server/Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**Nginx配置：**
```nginx
# WebSocket代理
location /ws {
  proxy_pass http://localhost:3001;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

**部署脚本：**
```bash
#!/bin/bash
# deploy.sh

# 构建
cd server
npm run build

# 启动（使用PM2）
pm2 start dist/index.js --name set13-server

# 或使用Docker
docker build -t set13-server .
docker run -d -p 3001:3001 set13-server
```

**验收：**
- [ ] Docker镜像能构建
- [ ] 能在4核8G服务器运行
- [ ] Nginx代理正常
- [ ] PM2自动重启

#### 5.5 监控和日志（1-2天）

```typescript
// 添加监控
import { metrics } from './monitoring';

// 记录关键指标
metrics.increment('game.created');
metrics.timing('combat.duration', duration);
metrics.gauge('rooms.active', activeRooms);

// 结构化日志
logger.info('Game started', {
  roomId,
  playerCount,
  botCount
});
```

**验收：**
- [ ] 关键指标有记录
- [ ] 日志可搜索
- [ ] 能诊断问题

---

## 时间线总览

| 阶段 | 内容 | 工期 | 累计 |
|------|------|------|------|
| 0 | 准备工作（M8合并） | 1-2天 | 2天 |
| 1 | 服务端框架 | 5-7天 | 9天 |
| 2 | 游戏状态同步 | 5-7天 | 16天 |
| 3 | AI机器人 | 10-15天 | 31天 |
| 4 | 8人对战系统 | 5-7天 | 38天 |
| 5 | 优化和完善（可选） | 10-15天 | 53天 |

**最小可玩版本（MVP）：** 阶段0-4，约5-6周  
**生产就绪版本：** 阶段0-5，约7-8周

---

## 风险和应对

### 风险1：M8 B10合并冲突
**影响：** 高  
**应对：** 
- 立即执行合并测试
- 发现冲突立即解决
- 必要时手动合并

### 风险2：9v9性能问题
**影响：** 中  
**应对：**
- 先做8人测试
- 如果慢，优化战斗计算
- 考虑分布式计算（多个服务器进程）

### 风险3：AI太弱或太强
**影响：** 中  
**应对：**
- 提供难度选择
- 持续调参
- 收集玩家反馈

### 风险4：网络延迟
**影响：** 低-中  
**应对：**
- 客户端预测
- 状态diff广播
- WebSocket优化

### 风险5：服务器崩溃
**影响：** 高  
**应对：**
- PM2自动重启
- 状态持久化
- 监控告警

---

## 成本估算

### 开发成本
- 人力：1个开发者，6-8周全职
- 如果按小时计费：240-320小时

### 服务器成本（4核8G）
- 阿里云/腾讯云：约200-300元/月
- 支持20-30个并发房间（160-240人同时在线）

### 其他成本
- 域名：约50元/年
- SSL证书：免费（Let's Encrypt）
- 总计：约200-300元/月运营成本

---

## 给GPT的执行提示

### 每个阶段开始时
1. 阅读完整的阶段文档
2. 创建该阶段的git分支
3. 按步骤逐个实现
4. 每个步骤提交一次代码

### 遇到问题时
1. 先查看测试输出
2. 检查日志
3. 使用console.log调试
4. 记录问题到测试报告

### 完成阶段时
1. 运行完整测试
2. 填写测试报告
3. 提交代码和文档
4. 通知Claude进行审查

### 代码质量要求
- TypeScript严格模式
- 所有public方法有注释
- 关键逻辑有单元测试
- 错误有日志记录

---

## 下一步行动

**立即执行（今天）：**
```bash
# 1. 合并M8 B10
cd /c/Users/Administrator/Desktop/set13
git checkout main
git checkout -b merge-m8-b10
git merge origin/feat/m8-b10 --no-ff

# 如果有冲突，停止并报告
# 如果无冲突，继续

# 2. 测试M8功能
npm install
npm run dev
# 手动测试：购买、装备、战斗

# 3. 合并到main
git checkout main
git merge merge-m8-b10
git push origin main

# 4. 创建多人改造分支
git checkout -b feat/multiplayer-base
git push origin feat/multiplayer-base
```

**明天开始：**
- 阅读`IMPLEMENTATION_PHASE1.md`
- 开始搭建服务端框架

**每周检查点：**
- 周五：阶段总结和演示
- 周一：下周计划和目标

---

## 附录

### A. 参考文档
- `MULTIPLAYER_ARCHITECTURE.md` - 架构设计
- `AI_STRATEGY_DESIGN.md` - AI策略
- `IMPLEMENTATION_PHASE1.md` - 阶段1详细步骤
- `M8_PLAN.md` - M8原始计划
- `M8_ACCEPTANCE.md` - M8验收标准

### B. 技术栈总结
- **服务端：** Node.js 22 + TypeScript + WebSocket (ws)
- **客户端：** Vite + TypeScript + Phaser 3
- **数据库：** SQLite（可选）
- **部署：** Docker + PM2 + Nginx

### C. 联系人
- **规划和审查：** Claude
- **主要实现：** GPT
- **决策：** 用户

### D. 版本控制
- **主分支：** main（稳定版本）
- **开发分支：** feat/multiplayer-base
- **功能分支：** feat/phase-N-xxx

---

**最后更新：** 2026-10-12  
**版本：** v1.0  
**状态：** 待执行
