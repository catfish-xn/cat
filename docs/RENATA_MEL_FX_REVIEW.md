# 烈娜塔施法与梅尔免死表现复核（2026-10-23）

分支 `codex/renata-mel-fx`，起点 `2780c13e`（本地 `origin/multiplayer`）。只改表现、测试与本地验收脚本；未改规则、服务器、CI、素材或提交 Git commit。

## 参考核对

只读来源：`/home/aiapps/workspcae/perf-1022/anim-ref/` 中两段动图及用户的十二帧拼图；对照册的 renata / mel `focus`、`notes` 同时核对。原图、拆帧与拼图均留在仓库外的 `fx-review/`。

- 烈娜塔 GIF 共 47 帧，每帧 40 ms。连续帧仅能清楚辨认一条紫色弹道，不能证明双罐双发；金色亮光与其他单位演出重叠，不纳入烈娜塔配色。紫色圆形反馈出现在后半段，参考范围与持续时长只能目测，不能据此推算技能判定。此次选择中心单发，保留双罐点火素材，目标处增加约 1.75 个格心间距的品红范围反馈，视觉持续 1 秒。
- 梅尔文件实际为 WebP，141 帧，每帧 100 ms。后段先有大范围紫蓝冲击，随后出现大型金色面容与光幕，不能把这张脸直接称为翅膀。按照本单要求，将冲击、金光的视觉顺序压缩成约 2 秒；普通施法不触发免死演出。
- 护盾只读取 `shieldLayerChanged / granted / remaining > 0`，以现有公开 EffectKeyTuple 的 ability 来源确认烈娜塔，再使用事件的 `targetId`。不计算弹道途经哪些友军，不产生护盾或伤害。来源键不认识时不显示专属护盾。

## 素材与程序化部分

| 效果 | 复用素材 | 程序化补全 |
| --- | --- | --- |
| 烈娜塔 | `renata_tft13_renataglasc_base_e_cas_r_canister`、`e_cas_l_canister`、`e_cas_center`、`e_mis_child_01`、`e_tar`、`e_aoe`（后三个简写沿用同一前缀） | 品红地面范围/旋纹；真实收据接收者的短暂护盾壳 |
| 梅尔 | 原有 `mel_tft13_missmage_base_p_damageredirect_cas`，推迟至金色阶段在弈士处播放 | 棋盘紫蓝冲击与中央晶状能量；全屏金色光幕和抽象光翼；2D 简化扩散环/金闪 |

未在现有梅尔导出特效中确认参考所示完整金色面容，因此不声称复刻了该面容；也未把常规 `r_*` 施法碎片冒充免死素材。所有资源仍由可配置素材根读取，没有复制素材。减少动效时保留低透明度静态圈/光幕与文字，取消新效果的扩张、晶体及粒子演出。

3D 通过 loader 注入现有 `reducedMotion()`；实现只有类型引用跨层，不值导入 2D 模块。2D 主要变化是 CSS、2 秒生命周期和已有偏好的读取。阶段切换取消烈娜塔排队/存活效果；梅尔反馈可跨战斗结算阶段，在期限或卸载时释放。

## 代码入口

- `src/rendering/three-mode/action-effect-plan.ts:5`：单枚弹体与命中素材的播放计划。
- `src/rendering/three-mode/reference-fx.ts:5`：视觉时间/大小、护盾收据选择、范围与护盾几何。
- `src/rendering/three-mode/placeholder-renderer.ts:750`：特效持有、事件接线、过期清理；`:1003` 为梅尔收据入口。
- `src/rendering/three-mode/three-loader.ts:94`：减少动效偏好注入。
- `src/rendering/three-mode/hud-style.ts:6`：仅 3D 加载的全屏金光。
- `src/rendering/mel-save-feedback.ts:4`、`src/rendering/mel-save-feedback.css:1`：共享触发/去重和 2D 简化反馈。
- `scripts/assets3d/renata-mel-browser-review.mjs:1`：生产渲染入口的真实素材组件预览与拼图脚本。

## 验证与证据

运行命令（软链 node_modules 只读，因此使用 runner，不生成 `.vite-temp`，关闭测试缓存）：

```sh
export PATH=$HOME/.local/bin:$PATH
npm run typecheck
npm test -- --configLoader runner --no-cache tests/rendering3d-reference-fx.test.ts tests/rendering3d-playtest-effects.test.ts tests/mel-save-feedback.test.ts tests/rendering3d-isolation.test.ts tests/rendering3d-action-effects.test.ts tests/rendering3d-mode.test.ts tests/rendering3d-tabletop.test.ts
CHROMIUM_PATH=/usr/bin/google-chrome node scripts/assets3d/renata-mel-browser-review.mjs /home/aiapps/workspace/set13-worktrees/boards/assets3d-local/test-server-v8 /home/aiapps/workspcae/perf-1022/fx-review /home/aiapps/workspcae/perf-1022/anim-ref
```

相关测试 7 个文件、65 项通过；typecheck 通过；隔离测试包含生产构建。未运行全套对局或正式 CI 的交互性能预算。

证据根目录：`/home/aiapps/workspcae/perf-1022/fx-review/`。

- `renata-comparison.png`、`mel-comparison.png`：左侧原始十二帧拼图，右侧各四帧真实渲染截图。
- `renata-{200,600,1050,1550}.png`；`mel-{200,500,1150,1700}.png`。
- `mel-reduced-1000.png`：应用内减少动效；`mel-2d-1000.png`：2D DOM 简化覆盖层（为便于比较沿用同一棋盘背景，未运行 Phaser 对局）。
- `review-report.json`：Chrome 版本、模型加载、粒子计数、跳过记录及浏览器错误。脚本使用生产挂载模块和合成 BoardFeed 收据，不代表整场联机验收。
- `baseline-size.json`、`current-size.json`：同一配置生产构建的顶层 JS 与独立 3D 块 gzip 字节。基线从 Git HEAD 原文加载，不改工作树。最终 2D：635,895 → 635,894 字节（-1）；3D：245,453 → 247,161 字节（+1,708）。

限制：原片没有足够证据确认烈娜塔发射罐数量和完整持续时长；梅尔金色脸部以程序化光幕近似。护盾来源依赖现有显示事件的来源键格式，若合同修改，需要同步此读取适配。
