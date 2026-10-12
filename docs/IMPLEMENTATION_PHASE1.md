# 实施指南 - 阶段1：基础多人框架

## 给GPT的执行清单

本文档包含**具体命令和代码**，可以直接复制给GPT执行。

---

## 前置条件

✅ M8 B10已合并到main
✅ 项目可以本地运行（npm run dev）
✅ 了解TypeScript和Node.js基础

---

## 阶段1目标

**完成时间：** 5-7天  
**目标：** 搭建服务端框架，2个真人能创建房间并看到彼此

**交付物：**
- ✅ WebSocket服务端运行
- ✅ 房间管理系统
- ✅ 客户端能连接服务器
- ✅ 大厅界面（创建/加入房间）

---

## 第1步：项目结构调整（30分钟）

### 1.1 创建服务端目录

```bash
cd /c/Users/Administrator/Desktop/set13

# 创建服务端目录结构
mkdir -p server/src/{types,room,sync,utils}
mkdir -p server/src/simulation

# 创建客户端multiplayer目录
mkdir -p src/multiplayer/{connection,state,commands,ui}
```

### 1.2 初始化服务端package.json

```bash
cd server

# 创建package.json
cat > package.json << 'EOF'
{
  "name": "set13-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "ws": "^8.18.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.7.0"
  }
}
EOF

# 安装依赖
npm install
```

### 1.3 配置TypeScript

```bash
# 在server目录创建tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
```

---

## 第2步：定义通信协议（1小时）

### 2.1 创建类型定义

**文件：** `server/src/types/protocol.ts`

```typescript
// 从客户端复用的类型
import type { MatchState, MatchEvent } from '../simulation/match-types.js';

// ===== 房间相关 =====

export interface RoomSettings {
  maxPlayers: number;        // 默认8
  botFillEnabled: boolean;   // 是否允许AI填充
  botDifficulty: 'easy' | 'medium' | 'hard';
  prepTimeSeconds: number;   // 准备阶段时长（默认30秒）
}

export interface Player {
  id: string;
  name: string;
  type: 'human' | 'bot';
  isReady: boolean;
  isEliminated: boolean;
  hp: number;
  rank: number | null;
}

export interface Room {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  round: number;
  settings: RoomSettings;
  createdAt: number;
}

// ===== 客户端 → 服务端消息 =====

export type ClientMessage =
  | { type: 'createRoom'; playerName: string; settings?: Partial<RoomSettings> }
  | { type: 'joinRoom'; roomId: string; playerName: string }
  | { type: 'leaveRoom' }
  | { type: 'ready' }
  | { type: 'command'; action: CommandAction; params: any };

export type CommandAction =
  | 'buyUnit'
  | 'sellUnit'
  | 'deploy'
  | 'combine'
  | 'equip'
  | 'reroll'
  | 'buyXp'
  | 'lockShop'
  | 'startCombat';

// ===== 服务端 → 客户端消息 =====

export type ServerMessage =
  | { type: 'roomCreated'; roomId: string; playerId: string }
  | { type: 'roomJoined'; room: RoomSnapshot; playerId: string }
  | { type: 'playerJoined'; player: Player }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'playerReady'; playerId: string; isReady: boolean }
  | { type: 'gameStart'; initialStates: Record<string, MatchState> }
  | { type: 'stateUpdate'; playerId: string; state: MatchState; events: MatchEvent[] }
  | { type: 'roundStart'; round: number }
  | { type: 'gameOver'; rankings: PlayerRanking[] }
  | { type: 'error'; message: string };

export interface RoomSnapshot {
  id: string;
  players: Player[];
  status: Room['status'];
  settings: RoomSettings;
}

export interface PlayerRanking {
  playerId: string;
  name: string;
  rank: number;
  hp: number;
}
```

---

## 第3步：实现WebSocket服务器（2小时）

### 3.1 创建服务器入口

**文件：** `server/src/index.ts`

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './room/RoomManager.js';
import { handleClientMessage } from './handlers.js';
import type { ClientMessage } from './types/protocol.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const wss = new WebSocketServer({ port: PORT });
const roomManager = new RoomManager();

// 存储 WebSocket → PlayerId 映射
const socketToPlayer = new Map<WebSocket, string>();
const playerToSocket = new Map<string, WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      const playerId = socketToPlayer.get(ws);

      await handleClientMessage(
        message,
        playerId,
        roomManager,
        ws,
        socketToPlayer,
        playerToSocket
      );
    } catch (error) {
      console.error('Message handling error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  });

  ws.on('close', () => {
    const playerId = socketToPlayer.get(ws);
    if (playerId) {
      console.log(`Player ${playerId} disconnected`);
      roomManager.handleDisconnect(playerId);
      socketToPlayer.delete(ws);
      playerToSocket.delete(playerId);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);
```

### 3.2 创建消息处理器

**文件：** `server/src/handlers.ts`

```typescript
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { ClientMessage, ServerMessage } from './types/protocol.js';
import type { RoomManager } from './room/RoomManager.js';

export async function handleClientMessage(
  message: ClientMessage,
  playerId: string | undefined,
  roomManager: RoomManager,
  ws: WebSocket,
  socketToPlayer: Map<WebSocket, string>,
  playerToSocket: Map<string, WebSocket>
) {
  switch (message.type) {
    case 'createRoom': {
      const newPlayerId = uuidv4();
      const room = roomManager.createRoom(newPlayerId, message.playerName, message.settings);
      
      socketToPlayer.set(ws, newPlayerId);
      playerToSocket.set(newPlayerId, ws);

      const response: ServerMessage = {
        type: 'roomCreated',
        roomId: room.id,
        playerId: newPlayerId
      };
      ws.send(JSON.stringify(response));
      break;
    }

    case 'joinRoom': {
      const newPlayerId = uuidv4();
      const room = roomManager.joinRoom(message.roomId, newPlayerId, message.playerName);

      socketToPlayer.set(ws, newPlayerId);
      playerToSocket.set(newPlayerId, ws);

      // 通知加入者
      const joinResponse: ServerMessage = {
        type: 'roomJoined',
        room: roomManager.getRoomSnapshot(room.id),
        playerId: newPlayerId
      };
      ws.send(JSON.stringify(joinResponse));

      // 通知房间内其他人
      const joinedNotif: ServerMessage = {
        type: 'playerJoined',
        player: room.players.find(p => p.id === newPlayerId)!
      };
      broadcastToRoom(room.id, joinedNotif, roomManager, playerToSocket, newPlayerId);
      break;
    }

    case 'ready': {
      if (!playerId) throw new Error('Not in a room');
      
      const room = roomManager.setPlayerReady(playerId, true);
      
      const readyMsg: ServerMessage = {
        type: 'playerReady',
        playerId,
        isReady: true
      };
      broadcastToRoom(room.id, readyMsg, roomManager, playerToSocket);
      
      // 检查是否所有人都ready
      if (roomManager.allPlayersReady(room.id)) {
        roomManager.startGame(room.id);
        // TODO: 发送gameStart消息
      }
      break;
    }

    case 'leaveRoom': {
      if (!playerId) break;
      
      const roomId = roomManager.getPlayerRoom(playerId);
      if (roomId) {
        roomManager.removePlayer(playerId);
        
        const leftMsg: ServerMessage = {
          type: 'playerLeft',
          playerId
        };
        broadcastToRoom(roomId, leftMsg, roomManager, playerToSocket);
      }
      
      socketToPlayer.delete(ws);
      playerToSocket.delete(playerId);
      break;
    }

    case 'command': {
      // TODO: Phase 2 - 游戏命令处理
      throw new Error('Game commands not implemented yet');
    }
  }
}

function broadcastToRoom(
  roomId: string,
  message: ServerMessage,
  roomManager: RoomManager,
  playerToSocket: Map<string, WebSocket>,
  excludePlayerId?: string
) {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  const json = JSON.stringify(message);
  
  for (const player of room.players) {
    if (player.id === excludePlayerId) continue;
    if (player.type === 'bot') continue;
    
    const socket = playerToSocket.get(player.id);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(json);
    }
  }
}
```

---

## 第4步：实现房间管理（2小时）

### 4.1 RoomManager类

**文件：** `server/src/room/RoomManager.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { Room, Player, RoomSettings, RoomSnapshot } from '../types/protocol.js';

export class RoomManager {
  private rooms = new Map<string, Room>();
  private playerToRoom = new Map<string, string>();

  createRoom(playerId: string, playerName: string, settingsOverride?: Partial<RoomSettings>): Room {
    const roomId = uuidv4();
    
    const settings: RoomSettings = {
      maxPlayers: 8,
      botFillEnabled: true,
      botDifficulty: 'medium',
      prepTimeSeconds: 30,
      ...settingsOverride
    };

    const player: Player = {
      id: playerId,
      name: playerName,
      type: 'human',
      isReady: false,
      isEliminated: false,
      hp: 100,
      rank: null
    };

    const room: Room = {
      id: roomId,
      status: 'waiting',
      players: [player],
      round: 0,
      settings,
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);
    this.playerToRoom.set(playerId, roomId);

    console.log(`Room ${roomId} created by ${playerName}`);
    return room;
  }

  joinRoom(roomId: string, playerId: string, playerName: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'waiting') throw new Error('Game already started');
    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Room is full');
    }

    const player: Player = {
      id: playerId,
      name: playerName,
      type: 'human',
      isReady: false,
      isEliminated: false,
      hp: 100,
      rank: null
    };

    room.players.push(player);
    this.playerToRoom.set(playerId, roomId);

    console.log(`Player ${playerName} joined room ${roomId}`);
    return room;
  }

  removePlayer(playerId: string): void {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);
    this.playerToRoom.delete(playerId);

    // 如果房间空了，删除房间
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    }
  }

  setPlayerReady(playerId: string, ready: boolean): Room {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) throw new Error('Player not in a room');

    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not in room');

    player.isReady = ready;
    return room;
  }

  allPlayersReady(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const humans = room.players.filter(p => p.type === 'human');
    return humans.length > 0 && humans.every(p => p.isReady);
  }

  startGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    // TODO: Phase 2 - 填充AI，初始化游戏状态
    room.status = 'playing';
    room.round = 1;
    
    console.log(`Game started in room ${roomId}`);
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getPlayerRoom(playerId: string): string | undefined {
    return this.playerToRoom.get(playerId);
  }

  getRoomSnapshot(roomId: string): RoomSnapshot {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    return {
      id: room.id,
      players: room.players,
      status: room.status,
      settings: room.settings
    };
  }

  handleDisconnect(playerId: string): void {
    // TODO: Phase 3 - 实现断线重连逻辑
    // 现在简单移除
    this.removePlayer(playerId);
  }
}
```

---

## 第5步：客户端WebSocket连接（2小时）

### 5.1 WebSocket客户端类

**文件：** `src/multiplayer/connection/WebSocketClient.ts`

```typescript
import type { ClientMessage, ServerMessage } from '../../../server/src/types/protocol';

type MessageHandler = (message: ServerMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('Connected to server');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as ServerMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('Disconnected from server');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    
    console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  on(type: ServerMessage['type'], handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // 返回清理函数
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  private handleMessage(message: ServerMessage): void {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }

    // 通用处理器
    const allHandlers = this.handlers.get('*' as any);
    if (allHandlers) {
      allHandlers.forEach(handler => handler(message));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
```

### 5.2 全局连接管理器

**文件：** `src/multiplayer/connection/ConnectionManager.ts`

```typescript
import { WebSocketClient } from './WebSocketClient';

class ConnectionManager {
  private client: WebSocketClient | null = null;
  private serverUrl: string;

  constructor() {
    // 开发环境：localhost，生产环境：实际服务器地址
    this.serverUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
  }

  async connect(): Promise<WebSocketClient> {
    if (this.client?.connected) {
      return this.client;
    }

    this.client = new WebSocketClient(this.serverUrl);
    await this.client.connect();
    return this.client;
  }

  getClient(): WebSocketClient | null {
    return this.client;
  }

  disconnect(): void {
    this.client?.disconnect();
    this.client = null;
  }
}

export const connectionManager = new ConnectionManager();
```

---

## 第6步：简单大厅UI（3小时）

### 6.1 创建Lobby Scene

**文件：** `src/multiplayer/ui/LobbyScene.ts`

```typescript
import Phaser from 'phaser';
import { connectionManager } from '../connection/ConnectionManager';
import type { ServerMessage } from '../../../server/src/types/protocol';

export class LobbyScene extends Phaser.Scene {
  private client: any = null;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create() {
    // 标题
    this.add.text(400, 100, 'Set 13 - Multiplayer Lobby', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // 创建房间按钮
    const createBtn = this.add.text(400, 250, 'Create Room', {
      fontSize: '24px',
      color: '#00ff00',
      backgroundColor: '#003300',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => this.createRoom());

    // 加入房间按钮
    const joinBtn = this.add.text(400, 350, 'Join Room', {
      fontSize: '24px',
      color: '#0088ff',
      backgroundColor: '#003366',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => this.joinRoom());

    // 连接状态
    this.add.text(400, 500, 'Connecting to server...', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5);

    this.connectToServer();
  }

  async connectToServer() {
    try {
      this.client = await connectionManager.connect();
      
      // 监听消息
      this.client.on('roomCreated', (msg: ServerMessage) => {
        if (msg.type === 'roomCreated') {
          console.log('Room created:', msg.roomId);
          this.scene.start('RoomScene', {
            roomId: msg.roomId,
            playerId: msg.playerId,
            client: this.client
          });
        }
      });

      this.client.on('roomJoined', (msg: ServerMessage) => {
        if (msg.type === 'roomJoined') {
          console.log('Room joined:', msg.room.id);
          this.scene.start('RoomScene', {
            roomId: msg.room.id,
            playerId: msg.playerId,
            client: this.client
          });
        }
      });

      this.client.on('error', (msg: ServerMessage) => {
        if (msg.type === 'error') {
          alert('Error: ' + msg.message);
        }
      });

      console.log('Connected to server');
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect to server');
    }
  }

  createRoom() {
    if (!this.client) {
      alert('Not connected to server');
      return;
    }

    const playerName = prompt('Enter your name:');
    if (!playerName) return;

    this.client.send({
      type: 'createRoom',
      playerName,
      settings: {
        maxPlayers: 8,
        botFillEnabled: true,
        botDifficulty: 'medium'
      }
    });
  }

  joinRoom() {
    if (!this.client) {
      alert('Not connected to server');
      return;
    }

    const roomId = prompt('Enter room ID:');
    if (!roomId) return;

    const playerName = prompt('Enter your name:');
    if (!playerName) return;

    this.client.send({
      type: 'joinRoom',
      roomId,
      playerName
    });
  }
}
```

### 6.2 创建Room Scene（房间等待界面）

**文件：** `src/multiplayer/ui/RoomScene.ts`

```typescript
import Phaser from 'phaser';
import type { WebSocketClient } from '../connection/WebSocketClient';
import type { ServerMessage, Player } from '../../../server/src/types/protocol';

interface RoomSceneData {
  roomId: string;
  playerId: string;
  client: WebSocketClient;
}

export class RoomScene extends Phaser.Scene {
  private roomId!: string;
  private playerId!: string;
  private client!: WebSocketClient;
  private players: Player[] = [];
  private playerTexts: Phaser.GameObjects.Text[] = [];
  private isReady = false;

  constructor() {
    super({ key: 'RoomScene' });
  }

  init(data: RoomSceneData) {
    this.roomId = data.roomId;
    this.playerId = data.playerId;
    this.client = data.client;
  }

  create() {
    // 房间信息
    this.add.text(400, 50, `Room: ${this.roomId.slice(0, 8)}`, {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // 玩家列表标题
    this.add.text(400, 120, 'Players:', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Ready按钮
    const readyBtn = this.add.text(400, 500, 'Ready', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#006600',
      padding: { x: 30, y: 15 }
    })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => this.toggleReady());

    // 离开按钮
    this.add.text(400, 560, 'Leave Room', {
      fontSize: '18px',
      color: '#ff0000',
      backgroundColor: '#660000',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => this.leaveRoom());

    // 监听服务器消息
    this.client.on('playerJoined', (msg: ServerMessage) => {
      if (msg.type === 'playerJoined') {
        this.players.push(msg.player);
        this.updatePlayerList();
      }
    });

    this.client.on('playerLeft', (msg: ServerMessage) => {
      if (msg.type === 'playerLeft') {
        this.players = this.players.filter(p => p.id !== msg.playerId);
        this.updatePlayerList();
      }
    });

    this.client.on('playerReady', (msg: ServerMessage) => {
      if (msg.type === 'playerReady') {
        const player = this.players.find(p => p.id === msg.playerId);
        if (player) {
          player.isReady = msg.isReady;
          this.updatePlayerList();
        }
      }
    });

    this.client.on('gameStart', (msg: ServerMessage) => {
      if (msg.type === 'gameStart') {
        console.log('Game starting!');
        // TODO: 切换到游戏场景
        alert('Game started! (Game scene not implemented yet)');
      }
    });
  }

  updatePlayerList() {
    // 清除旧文本
    this.playerTexts.forEach(t => t.destroy());
    this.playerTexts = [];

    // 显示玩家列表
    this.players.forEach((player, index) => {
      const y = 180 + index * 40;
      const isMe = player.id === this.playerId;
      const readyIcon = player.isReady ? '✓' : '○';
      const meTag = isMe ? ' (You)' : '';
      
      const text = this.add.text(400, y, 
        `${readyIcon} ${player.name}${meTag}`, {
        fontSize: '20px',
        color: player.isReady ? '#00ff00' : '#ffffff'
      }).setOrigin(0.5);

      this.playerTexts.push(text);
    });
  }

  toggleReady() {
    this.isReady = !this.isReady;
    
    this.client.send({
      type: 'ready'
    });
  }

  leaveRoom() {
    this.client.send({
      type: 'leaveRoom'
    });

    this.scene.start('LobbyScene');
  }
}
```

### 6.3 注册Scene到游戏

**文件：** `src/main.ts` (修改)

找到Phaser游戏配置部分，添加新Scene：

```typescript
import { LobbyScene } from './multiplayer/ui/LobbyScene';
import { RoomScene } from './multiplayer/ui/RoomScene';

// 在现有的scene数组中添加
scene: [
  LobbyScene,     // 新增
  RoomScene,      // 新增
  // ... 其他现有scene
]
```

---

## 第7步：环境变量配置

### 7.1 客户端环境变量

**文件：** `.env.development`

```bash
VITE_WS_URL=ws://localhost:3001
```

**文件：** `.env.production`

```bash
VITE_WS_URL=wss://your-server-domain.com
```

### 7.2 服务端环境变量

**文件：** `server/.env`

```bash
PORT=3001
NODE_ENV=development
```

---

## 第8步：测试运行

### 8.1 启动服务端

```bash
cd /c/Users/Administrator/Desktop/set13/server
npm run dev
```

应该看到：
```
WebSocket server running on ws://localhost:3001
```

### 8.2 启动客户端

```bash
cd /c/Users/Administrator/Desktop/set13
npm run dev
```

### 8.3 测试步骤

1. 打开浏览器：http://localhost:5173
2. 应该看到Lobby界面
3. 点击"Create Room"，输入名字
4. 复制房间ID
5. 打开第二个浏览器窗口（或无痕模式）
6. 点击"Join Room"，粘贴房间ID，输入名字
7. 两个窗口应该都能看到对方
8. 点击"Ready"，两个都ready后应该收到gameStart消息

---

## 验收标准

阶段1完成的标志：

- [ ] 服务端启动无错误
- [ ] 客户端能连接到服务器
- [ ] 能创建房间并获得roomId
- [ ] 第二个客户端能加入房间
- [ ] 房间内能看到玩家列表
- [ ] Ready状态能同步
- [ ] 离开房间功能正常
- [ ] 服务端日志显示正确的房间状态

---

## 常见问题

### Q1: WebSocket连接失败
```
检查：
1. 服务端是否启动？
2. 端口3001是否被占用？
3. 防火墙是否阻止？
4. .env配置是否正确？
```

### Q2: 类型错误
```
确保：
1. server/tsconfig.json配置正确
2. 客户端能访问server/src/types/
3. 两边TypeScript版本一致
```

### Q3: 消息收不到
```
检查：
1. WebSocket.readyState是否为OPEN
2. JSON序列化是否正确
3. 浏览器console是否有错误
4. 服务端console是否有错误
```

---

## 下一步

阶段1完成后，进入**阶段2：游戏状态同步**

主要任务：
1. 复制simulation/到服务端
2. 实现命令执行和验证
3. 状态广播
4. 客户端渲染远程状态

详见：`IMPLEMENTATION_PHASE2.md`
