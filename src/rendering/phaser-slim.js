// Production alias target for `import Phaser from 'phaser'` (see vite.config.ts).
// The stock bundle ships Matter/Arcade physics, tilemaps, particles, sound and
// every game object (~316 kB gzip). This keeps Phaser's own core build and adds
// only the game objects the board uses beyond it. Types still come from 'phaser'.
// When a new Phaser class or `this.add.*` factory is needed, register it here.
import Phaser from 'phaser/src/phaser-core.js';
import Color from 'phaser/src/display/color/index.js';
import Container from 'phaser/src/gameobjects/container/Container.js';
import Arc from 'phaser/src/gameobjects/shape/arc/Arc.js';
import 'phaser/src/gameobjects/container/ContainerFactory.js';
import 'phaser/src/gameobjects/shape/arc/ArcFactory.js';

Phaser.Display.Color = Color;
Phaser.GameObjects.Container = Container;
Phaser.GameObjects.Arc = Arc;

export default Phaser;
