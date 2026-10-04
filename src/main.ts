import Phaser from 'phaser';
import { BoardScene } from './rendering/BoardScene';
import './style.css';
new Phaser.Game({ type: Phaser.AUTO, parent: 'app', width: 960, height: 800, backgroundColor: '#101923', scene: [BoardScene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true } });
