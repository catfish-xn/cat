import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import type { Plugin } from 'vite';

type Replacement = { start: number; end: number; text: string };
const normalize = (path: string) => path.replaceAll('\\', '/');
const ENTRY_STRING_SEPARATOR = '|';

/** Share values, never rename properties: obj.longName becomes obj[key], where
 * key is still exactly "longName". JSON, enumeration, reflection and wire IDs are
 * unchanged. Only the application entry is eligible (no eager circular imports).
 * Run before Vite's esbuild pass, which minifies the new local bindings too. */
export function compactEntryStrings(code: string): string {
  const file = ts.createSourceFile('entry.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const groups = new Map<string, { start: number; end: number; kind: 'value' | 'key' | 'optional' }[]>();
  let prefix = '__sharedText';
  while (code.includes(prefix)) prefix += '_';
  const add = (value: string, start: number, end: number, kind: 'value' | 'key' | 'optional') => {
    // __proto__ in object literal syntax is special. Keep delimiter-containing
    // values inline so joining/splitting the dictionary cannot change any text.
    if (value.length < 4 || value === '__proto__' || value.includes('\0') || value.includes(ENTRY_STRING_SEPARATOR)) return;
    const entries = groups.get(value) ?? [];
    entries.push({ start, end, kind }); groups.set(value, entries);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'eval')
      throw new Error('compact-entry-strings: direct eval needs an explicit scope audit');
    if (ts.isIdentifier(node) || ts.isStringLiteral(node)) {
      const parent = node.parent;
      if (ts.isIdentifier(node) && ts.isPropertyAccessExpression(parent) && parent.name === node) {
        add(node.text, parent.expression.end, parent.end, parent.questionDotToken ? 'optional' : 'key');
      } else if (ts.isPropertyAssignment(parent) && parent.name === node) {
        add(node.text, node.getStart(file), node.end, 'key');
      } else if (ts.isStringLiteral(node)
        && (parent as ts.NamedDeclaration).name !== node
        && !(ts.isBindingElement(parent) && parent.propertyName === node)
        && !ts.isImportDeclaration(parent) && !ts.isExportDeclaration(parent)
        && !ts.isImportSpecifier(parent) && !ts.isExportSpecifier(parent) && !ts.isImportAttribute(parent)
        && !ts.isExpressionStatement(parent)
        && !(ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword)) {
        add(node.text, node.getStart(file), node.end, 'value');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  const names: string[] = [], values: string[] = [], replacements: Replacement[] = [];
  // Sorting puts related source IDs together within gzip's finite dictionary window.
  for (const [value, occurrences] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (occurrences.length < 3) continue;
    const name = `${prefix}${names.length}`;
    names.push(name); values.push(value);
    for (const occurrence of occurrences) replacements.push({ ...occurrence,
      text: occurrence.kind === 'value' ? name : `${occurrence.kind === 'optional' ? '?.' : ''}[${name}]` });
  }
  if (!names.length) return code;
  const parts: string[] = []; let offset = 0;
  for (const { start, end, text } of replacements.sort((a, b) => a.start - b.start)) {
    if (start < offset) throw new Error('compact-entry-strings: overlapping syntax');
    parts.push(code.slice(offset, start), text); offset = end;
  }
  parts.push(code.slice(offset));
  let prologueEnd = 0;
  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    prologueEnd = statement.end;
  }
  const body = parts.join('');
  return `${body.slice(0, prologueEnd)}\nconst [${names.join(',')}]=${JSON.stringify(values.join(ENTRY_STRING_SEPARATOR))}.split(${JSON.stringify(ENTRY_STRING_SEPARATOR)});\n${body.slice(prologueEnd)}`;
}

// Pin upstream code we specialize. An engine update must be re-audited instead
// of silently losing a required export or leaving an optional require in place.
// phaser is pinned to an exact version in package.json for the same reason. Changing
// a flag in vite.config.ts replacePhaserFlags (e.g. enabling WEBGL_DEBUG) also needs a re-audit.
const PHASER_HASHES: Record<string, string> = {
  'math/index.js': '14f321d1a69a8f55c1ab8d20e4440029f3a2667d064b372ae0874051136d7709',
  'core/Config.js': '06b52660193d26c96cba779dab3bb2d7363725a14f08ace3ea5e4f622e36f5c9',
  'utils/object/GetAdvancedValue.js': 'b9fb0626071305a3815c6e231f33979d47950700675ac24a3c168647bff00281',
  'renderer/webgl/PipelineManager.js': 'b61b5ce35add4b145c55646fb62718442bf1efce2339c82ec2a41a15f083b29c',
  'gameobjects/components/FX.js': '7595258ec8b706d599154b9e87651ca0d5db36ca3fc001dcdf22f289b02fbef3',
  'gameobjects/components/index.js': '5171d771c6ff8712d67759d834e0e21d8ce85ce763cd3daa61b8b4296876cbff',
  'cameras/2d/Camera.js': '4e7e7a70fed8cf91021568ef5c6e175ee6e4f23ad71bbe4374f4df701baefc33',
  'math/easing/EaseMap.js': '02d9c9173a8997d5bbbccb127b677513f298e4a0523717f250037e8f92a17295',
  'textures/parsers/index.js': 'e43e7474a7ce178671d29059dca68a31120740c313bfe84187c0914c978f113f',
  'textures/TextureManager.js': '936321645a8c277757be93628d5d9b6e3eb48017c83a6ad371b715a3567cb4bc',
  'input/InputManager.js': '79793d816c885405de019c8660020f378765901cd56f552c43a93c7adc4f49b4',
  'utils/array/index.js': 'a9d7c3f1aa8199d22e373a7a7919604b48e2ac077e01d2fb556f27a7b74a7c1a',
};
const CAMERA_NO_EFFECT = [
  'function CameraNoEffect(camera) { this.camera = camera; }',
  'CameraNoEffect.prototype.start = function () { throw new Error("camera effects are not in this build"); };',
  'CameraNoEffect.prototype.reset = function () {};',
  'CameraNoEffect.prototype.update = function () {};',
  'CameraNoEffect.prototype.preRender = function () {};',
  'Object.defineProperty(CameraNoEffect.prototype, "isRunning", { get: function () { return false; } });',
  'var Effects = { Fade: CameraNoEffect, Flash: CameraNoEffect, Shake: CameraNoEffect, Pan: CameraNoEffect, RotateTo: CameraNoEffect, Zoom: CameraNoEffect };',
].join('\n');
const KEPT_EASE_MAP = [
  "var Linear = require('./linear');",
  "var Quadratic = require('./quadratic');",
  "var Cubic = require('./cubic');",
  "var Sine = require('./sine');",
  'module.exports = {',
  '    Power0: Linear, Power1: Quadratic.Out, Power2: Cubic.Out, Linear: Linear,',
  '    Quad: Quadratic.Out, Cubic: Cubic.Out, Sine: Sine.Out,',
  "    'Quad.easeIn': Quadratic.In, 'Quad.easeOut': Quadratic.Out, 'Quad.easeInOut': Quadratic.InOut,",
  "    'Cubic.easeIn': Cubic.In, 'Cubic.easeOut': Cubic.Out, 'Cubic.easeInOut': Cubic.InOut,",
  "    'Sine.easeIn': Sine.In, 'Sine.easeOut': Sine.Out, 'Sine.easeInOut': Sine.InOut",
  '};',
].join('\n');
const KEPT_EASES = new Set(['Sine.easeInOut', 'Sine.easeOut', 'Cubic.easeOut', 'Quad.easeIn']);
const dropLine = (code: string, module: string, pattern: RegExp) => {
  const next = code.replace(pattern, '');
  if (next === code) throw new Error(`trim-phaser-runtime: expected line missing in ${module}`);
  return next;
};
export function trimPhaserRuntime(code: string, module: string): string {
  const expected = PHASER_HASHES[module];
  if (!expected) return code;
  // npm publishes these files as CRLF; normalize checkout line endings first.
  const crlf = code.replace(/\r?\n/g, '\r\n');
  if (createHash('sha256').update(crlf).digest('hex') !== expected)
    throw new Error(`trim-phaser-runtime: re-audit changed upstream ${module}`);
  if (module === 'math/index.js') {
    // Config creates RND; GetAdvancedValue reads that SAME singleton. All other
    // engine consumers use direct leaf imports, which remain untouched.
    return code.replace(/^    (\w+): require\('[^']+'\),?\r?$/gm,
      (line, name: string) => name === 'RandomDataGenerator' ? line : '');
  }
  if (module === 'gameobjects/components/index.js') {
    // Image/Text/Container/Shape import this CommonJS namespace, so Rollup cannot
    // drop its unused mixins. None of our registered objects follows a Path.
    // Leave all other exports and their lifecycle behavior intact.
    return code.replace("    PathFollower: require('./PathFollower'),", '');
  }
  if (module === 'renderer/webgl/PipelineManager.js') {
    // These are Phaser's existing disablePreFX / disablePostFX paths. Keep the
    // ordinary Multi/BitmapMask/Utility/etc pipelines and all their shaders.
    return code.replace("var FX = require('./pipelines/fx');", 'var FX = {};')
      .replace("var FXPipeline = require('./pipelines/FXPipeline');", 'var FXPipeline = undefined;')
      .replace('var disablePreFX = this.game.config.disablePreFX;', 'var disablePreFX = true;')
      .replace('var disablePostFX = this.game.config.disablePostFX;', 'var disablePostFX = true;');
  }
  // Preserve the FX component's empty-state lifecycle (created/destroyed by
  // Image/Text). No game code creates effect controllers; don't bundle them.
  if (module === 'gameobjects/components/FX.js')
    return code.replace("var Effects = require('../../fx/');", 'var Effects = {};');
  // The board never calls camera fade/flash/shake/pan/zoom/rotateTo. update() still
  // ticks the effect objects every frame, so they stay as no-ops and start() throws.
  if (module === 'cameras/2d/Camera.js')
    return code.replace("var Effects = require('./effects');", CAMERA_NO_EFFECT);
  // Tweens in this game use Sine, Cubic and Quad only. Power0 (Linear) is Phaser's default.
  if (module === 'math/easing/EaseMap.js') return KEPT_EASE_MAP;
  // Portraits enter through Parser.Image / addImage. Atlas, spritesheet, KTX and PVR parsers have no caller.
  if (module === 'textures/parsers/index.js')
    return "module.exports = {\n    Image: require('./Image')\n};\n";
  if (module === 'textures/TextureManager.js')
    return code.replace("var DynamicTexture = require('./DynamicTexture');", 'var DynamicTexture = function () { throw new Error("DynamicTexture is not in this build"); };');
  // Shortcuts are native keydown listeners. Phaser's KeyboardManager is not constructed.
  if (module === 'input/InputManager.js')
    return code.replace("var Keyboard = require('./keyboard/KeyboardManager');", 'var Keyboard = null;')
      .replace('this.keyboard = (config.inputKeyboard) ? new Keyboard(this) : null;', 'this.keyboard = null;');
  // Container uses a subset. Matrix and the other names below are only reached through this barrel.
  if (module === 'utils/array/index.js') {
    for (const name of ['Matrix', 'EachInRange', 'NumberArrayStep', 'RemoveRandomElement', 'RotateLeft', 'RotateRight'])
      code = dropLine(code, module, new RegExp(`^\\s*${name}: require\\('\\./(?:matrix|${name})'\\),?\\r?\\n`, 'm'));
    return code;
  }
  return code;
}

export function assertProductionSurface(code: string, id: string): void {
  if (/\b(?:DynamicTexture|addDynamicTexture|addAtlas|addSpriteSheet|addUnityYAML)\b/.test(code))
    throw new Error(`trim-phaser-runtime: removed texture API used in ${id}`);
  for (const match of code.matchAll(/\bease:\s*['"]([^'"]+)['"]/g)) {
    if (!KEPT_EASES.has(match[1]!))
      throw new Error(`trim-phaser-runtime: ease ${match[1]} is not in the production EaseMap (${id})`);
  }
}

export function assertNoPhaserFxUse(code: string, id: string): void {
  const forbidden = new Set(['preFX', 'postFX', 'setPostPipeline', 'setPipeline', 'disablePreFX', 'disablePostFX']);
  const file = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    const name = ts.isPropertyAccessExpression(node) ? node.name
      : ts.isElementAccessExpression(node) ? node.argumentExpression
      : ts.isBindingElement(node) ? node.propertyName ?? node.name
      : ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) ? node.name : undefined;
    if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) && forbidden.has(name.text))
      throw new Error(`trim-phaser-runtime: FX/pipeline use in ${id}; restore the full engine before using ${name.text}`);
    ts.forEachChild(node, visit);
  };
  visit(file);
}

// Archive columns on frozen source tables. Runtime reads names, descriptions and values;
// these keys are provenance for the content audit and are not part of any rule result.
const AUDIT_KEY = /^[ \t]*"(?:pointer|sourceName|titleKey|descriptionKey|rawKey)":\s*"(?:[^"\\\n]|\\.)*",?\r?\n/gm;
const AUDIT_SOURCE = /[\\/]src[\\/]simulation[\\/](?:content[\\/][^\\/]*-source|anomalies[\\/]source)\.ts$/;

export function productionSizePlugins(): Plugin[] {
  return [{
    name: 'strip-content-audit-keys', apply: 'build', enforce: 'pre',
    transform(code, id) {
      if (!AUDIT_SOURCE.test(normalize(id))) return null;
      const stripped = code.replace(AUDIT_KEY, '');
      if (stripped === code) return null;
      if (/"pointer":|"rawKey":|"titleKey":|"descriptionKey":/.test(stripped))
        this.error(`strip-content-audit-keys: unexpected layout in ${id}`);
      return { code: stripped, map: null };
    },
  }, {
    name: 'trim-phaser-runtime', apply: 'build', enforce: 'pre',
    transform(code, id) {
      const path = normalize(id), marker = '/node_modules/phaser/src/', at = path.indexOf(marker);
      if (at < 0) {
        if (!path.includes('/node_modules/') && /\/src\/.*\.(?:[cm]?[jt]s|[jt]sx)$/.test(path)) {
          assertNoPhaserFxUse(code, id);
          assertProductionSurface(code, id);
        }
        return null;
      }
      const module = path.slice(at + marker.length), root = path.slice(0, at + marker.length);
      for (const [, specifier] of code.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        const target = normalize(resolve(dirname(id), specifier));
        if ([`${root}math`, `${root}math/index`, `${root}math/index.js`].includes(target)
          && !['core/Config.js', 'utils/object/GetAdvancedValue.js'].includes(module))
          this.error(`trim-phaser-runtime: unreviewed Math namespace consumer ${module}`);
      }
      const trimmed = trimPhaserRuntime(code, module);
      return trimmed === code ? null : { code: trimmed, map: null };
    },
  }, {
    name: 'compact-entry-strings', apply: 'build',
    renderChunk(code, chunk) {
      if (!chunk.isEntry || !chunk.moduleIds.some(id => normalize(id).endsWith('/src/main.ts'))) return null;
      return { code: compactEntryStrings(code), map: null };
    },
    generateBundle(_options, bundle) {
      for (const entry of Object.values(bundle)) {
        if (entry.type !== 'chunk' || !entry.isEntry || !entry.moduleIds.some(id => normalize(id).endsWith('/src/main.ts'))) continue;
        const pending = [...entry.imports], visited = new Set<string>();
        for (const name of pending) {
          // An eager cycle could call an exported function before the entry's
          // dictionary is initialized. Lazy 3D imports aren't such a cycle.
          if (name === entry.fileName) this.error('compact-entry-strings: eager entry cycle needs an initialization audit');
          if (visited.has(name)) continue;
          visited.add(name);
          const target = bundle[name];
          if (target?.type === 'chunk') pending.push(...target.imports);
        }
      }
    },
  }];
}
