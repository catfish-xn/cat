# 3D 渲染试验（S13 / 14.24）

独立试验页，不属于正式游戏：不进根目录 `vite build`、不进 `/cat/` 部署、不计入 m7 JS 体积预算。
只用来看“用官方 3D 模型能把画面做到什么程度”。

## 运行

```bash
cd experiments/3d-trial
npm install
npm run fetch-assets   # 从 CommunityDragon 下载并转换素材到 public/assets/（已 gitignore）
npm run dev            # 打开终端里给出的地址
```

拳头的模型、贴图、特效参数都是版权素材，**不提交进仓库**；`public/assets/` 每次由 `tools/fetch-assets.mjs` 重新生成。

截图（需要根目录已 `npm ci` 装好 playwright）：

```bash
CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
PLAYWRIGHT_PATH=../../node_modules/playwright \
node tools/screenshot.mjs shots idle,attack,cast,impact,death,ui
```

页面参数：`?shot=idle|attack|cast|impact|death` 固定到某一瞬间；`&zoom` 拉近镜头；
`&vfxScale=1` 按原版数值 1:1 放特效（默认 0.6）；`&only=正则` 只播名字匹配的特效发射器（调试用）。

## 文件

| 文件 | 作用 |
| --- | --- |
| `tools/fetch-assets.mjs` | 下载 `.skn` 网格、PNG 贴图、角色 `.bin` 的 JSON；`.skn` → `.glb`；挑出金克丝大招的粒子系统和它用到的贴图、溶解图 |
| `src/main.js` | 场景、镜头、自建六边形棋盘、英雄、程序动作、血条、控件 |
| `src/vfx.js` | 原版粒子定义（`VfxSystemDefinitionData`）的简化解释器 |
| `tools/screenshot.mjs` | 无头浏览器截图 |

## 能拿到 / 拿不到

- 能拿到：英雄网格 `.skn`（含蒙皮权重）、贴图（已转 PNG）、粒子定义（`game/characters/<英雄>.cdtb.bin.json`）和粒子贴图。
- 拿不到：骨骼 `.skl`、动作 `.anm`、粒子网格 `.scb`、竞技场几何 `.mapgeo`。CommunityDragon 不发布这几类文件；拳头补丁 CDN 在这个环境被代理拦了。
  所以页面里的动作是程序动画（位移/旋转），棋盘是自建的。
