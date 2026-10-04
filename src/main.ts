import Phaser from 'phaser';
import { BoardScene } from './rendering/BoardScene';
import './style.css';
const app = document.getElementById('app')!;
const board = document.createElement('main'); board.id = 'board-root'; board.setAttribute('aria-label', '自动战棋棋盘');
const strategy = document.createElement('aside'); strategy.id = 'strategy-root'; strategy.setAttribute('aria-label', '策略构筑');
app.append(board, strategy);
new Phaser.Game({ type: Phaser.AUTO, parent: 'board-root', width: 960, height: 800, backgroundColor: '#101923', scene: [BoardScene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true } });
