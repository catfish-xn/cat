// Production alias target for `import Phaser from 'phaser'` (see vite.config.ts).
// The stock bundle ships Matter/Arcade physics, tilemaps, particles, sound and
// every game object (~316 kB gzip). Phaser's own core build (phaser-core.js) still
// carries unused loaders, Sprite/Layer, keyboard/gamepad, FX and DOM namespaces, so
// this assembles the namespace by hand from only what the board uses. Types still
// come from 'phaser'. When a new Phaser class or `this.add.*` factory is needed,
// register it here. Scene plugins register themselves on import, so every default
// scene plugin the board touches (this.tweens, this.input, this.load, ...) is
// imported for its side effect below.
import 'phaser/src/polyfills/requestVideoFrame.js';
import CONST from 'phaser/src/const.js';
import Extend from 'phaser/src/utils/object/Extend.js';
import Game from 'phaser/src/core/Game.js';
import Scene from 'phaser/src/scene/Scene.js';
import SceneEvents from 'phaser/src/scene/events/index.js';
import CoreEvents from 'phaser/src/core/events/index.js';
import Scale from 'phaser/src/scale/index.js';
import Vector2 from 'phaser/src/math/Vector2.js';
import Components from 'phaser/src/gameobjects/components/index.js';
import GameObject from 'phaser/src/gameobjects/GameObject.js';
import Graphics from 'phaser/src/gameobjects/graphics/Graphics.js';
import Image from 'phaser/src/gameobjects/image/Image.js';
import Text from 'phaser/src/gameobjects/text/Text.js';
import Container from 'phaser/src/gameobjects/container/Container.js';
import Arc from 'phaser/src/gameobjects/shape/arc/Arc.js';
import 'phaser/src/gameobjects/graphics/GraphicsFactory.js';
import 'phaser/src/gameobjects/image/ImageFactory.js';
import 'phaser/src/gameobjects/text/TextFactory.js';
import 'phaser/src/gameobjects/container/ContainerFactory.js';
import 'phaser/src/gameobjects/shape/arc/ArcFactory.js';
import 'phaser/src/loader/filetypes/ImageFile.js';
import 'phaser/src/events/EventEmitter.js';
import 'phaser/src/cameras/2d/CameraManager.js';
import 'phaser/src/gameobjects/GameObjectCreator.js';
import 'phaser/src/gameobjects/GameObjectFactory.js';
import 'phaser/src/scene/ScenePlugin.js';
import 'phaser/src/gameobjects/DisplayList.js';
import 'phaser/src/gameobjects/UpdateList.js';
import 'phaser/src/time/Clock.js';
import 'phaser/src/data/DataManagerPlugin.js';
import 'phaser/src/input/InputPlugin.js';
import 'phaser/src/loader/LoaderPlugin.js';
import 'phaser/src/tweens/TweenManager.js';

const Phaser = Extend(false, {
  Game, Scene, Scenes: { Events: SceneEvents }, Core: { Events: CoreEvents }, Scale,
  // No runtime consumer uses the public Color utility namespace. Engine classes
  // still import their required color helpers directly (Canvas/Text keep them).
  Math: { Vector2 },
  GameObjects: { Components, GameObject, Graphics, Image, Text, Container, Arc },
}, CONST);
export default Phaser;
