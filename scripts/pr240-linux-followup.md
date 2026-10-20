# PR #240 Linux 验收修复记录

评审来源：`C:/Users/Administrator/Desktop/codex-runs/equip-drag/review-6284593945.md`。
评审运行 HEAD 为 `02da610`，对照基线为 `a0d42c5`。以下基线失败均来自该评审，本次没有重新运行或修复。

| 入口 | 已记录的基线失败 |
| --- | --- |
| m4-browser（含 preview） | `R1 buy insufficient-gold`，发生于 generate-m4-route |
| m8-br4-public | `br4-thiefs-gloves: complete recipe through public rewards`，浏览器启动前的夹具生成失败 |
| m8-desktop | `CompatibilityError: 存档无效：不支持的文件版本`（s13-g2-3-v14） |
| m8-u3-static | 评审确认基线上同样失败，未列具体报错 |
| c18b-loot-preview | `the record page has a removal line ("")` |
| c18b-use-consumable | 4 条 malformed 都返回 `receipt:unsupported-protocol` |

## 本次修复

- U3 的失败断言改为 `assert(!refused.events?.length)`，保留失败原因、完整返回状态和会话状态/账本不变检查。
- `verify-equipment-synthesis.cjs` 独立运行护甲 + 腰带 → 日炎斗篷的原生拖拽检查；不生成 BR4 夹具。
- `tests/fixtures/equipment-synthesis.ts` 用现有 B8 公共命令/奖励路线获取组件，记录战斗历史，按当前 v3 格式校验存档。没有注入状态或直接授予物品。
- 每个模式先后拖两件组件到同一单位，逐次比对完整状态；最终检查单位装备槽、两件组件被消耗、库存 DOM 条目消失及单位详情文本。BR4 中重复的合成检查已移除，保留独立入口说明。

## 本机检查

仅执行语法、类型和领域/拖拽 helper 测试，没有执行浏览器脚本。
结果：3 个脚本的语法检查通过，TypeScript 检查通过，3 个相关 Vitest 文件共 22 项测试通过。
标准 Vitest 配置打包在本机受目录访问限制，改用 Node 原生配置加载器执行同一项目及测试文件。

```powershell
node --check scripts/verify-m8-u3-dynamic.cjs
node --check scripts/verify-m8-br4-public.cjs
node --check scripts/verify-equipment-synthesis.cjs
node node_modules/typescript/bin/tsc --noEmit
node --experimental-strip-types node_modules/vitest/vitest.mjs run --configLoader native --project fast tests/equipment-synthesis-fixture.test.ts tests/equipment-input.test.mjs tests/t13-auto-combine.test.ts --maxWorkers 1
```

## Linux 复跑

在具备现有 Playwright Chromium 的 Linux checkout 执行；新入口每次均覆盖 dev 与 production preview。
各 tab 模式使用独立证据目录，避免覆盖结果。

```bash
npm run build && npm run build:game
for tab in visible hidden; do
  EQUIPMENT_TAB="$tab" U3_EVIDENCE_DIR="artifacts/m8-u3-dynamic-$tab" node scripts/verify-m8-u3-dynamic.cjs || exit 1
  EQUIPMENT_TAB="$tab" SYNTHESIS_EVIDENCE_DIR="artifacts/equipment-synthesis-$tab" node scripts/verify-equipment-synthesis.cjs || exit 1
done
```

预期：两种 tab 模式的 U3 均通过，新入口每次的 manifest 都有 dev、preview 两条成功检查且 `passed: true`。
本机静态/领域验证不代表 Linux 浏览器验收已通过。

建议提交信息：`test: fix rejected combine assertion and isolate native equipment synthesis`
