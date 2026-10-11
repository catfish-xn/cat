# M8 B10 验证记录

本轮由 Codex 按用户 2026-10-11 授权接替 Claude 收尾，包含必要的 UI 修复。
起点 `9fa8a6334b6cee862767fe39c4e35fc9eb8bac14`；main 文档同步合并 `e2c98f5`。
节点1/2签收保持；本文件不把此前 CI 当作新候选的结果。

## 环境与方法

- Node 22.23.3、npm 11.9.0、锁定的 Vitest 5.0.3 / Playwright 1.63.0；Chromium 151.0.7922.173。
- 云容器 CPU 配额 4 核、内存上限 16 GiB。正式性能采样串行运行；浏览器 GPU 通过 CDP 记录。
- 本地 Chromium 通过 `CHROMIUM_PATH=/usr/bin/chromium` 选择。软件图形数据仅报告，不能据其签收硬件桌面帧率。
- 所有脚本保留失败日志，修复测试准备问题时说明原因；不改生产规则、固定 tick、预算、超时、golden 或已有 skip。

## 检查入口与当前结果

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 类型/构建 | `npm run build` | 收尾期间通过；最终候选待绑定 |
| B10 单测 | `npm test -- tests/m8-b10-encounter-outcomes.test.ts tests/m8-b10-item-save-replay.test.ts tests/m8-b10-temporary-replay.test.ts` | 94/94 通过（46 遭遇 + 45 全装备 + 3 临时装备） |
| U3 静态 | `node scripts/verify-m8-u3-static.cjs` | 执行中；production preview、1440×1000、真实公开路线存档导入 |
| U4 状态/盾/治疗 | `node scripts/verify-m8-u4-status.cjs` | 15 场景 / 181 检查通过；最终候选待绑定 |
| 桌面补充 | `node scripts/verify-m8-desktop.cjs` | 待运行；三桌面尺寸 × dev/preview，严格 Pages 子路径 |
| 压力 | `node scripts/verify-m8-performance.cjs --target=preview` | 待正式采样；30 公开完整路线、两种 9v9 各 30 seed、完整浏览器战斗 |
| M7 配对 | `node scripts/m7-budget.cjs --base=/workspace/m8-b10-m7-base/dist --js-base=/workspace/m8-b10-m7-base/dist --current=dist --samples=9 --out=artifacts/m8-m7-budget` | 待运行；基线 15313a7，两边各自锁文件，相同 Node 工具链 |
| 完整 CI | 现有 CI workflow，候选 PR | 待提交候选后执行，不修改 CI 配置或门槛 |

## 首失败与纠正

- U3 首次遍历没有显式超时，停止该运行并加入有界等待。装备槽 hover 的独立真实鼠标探针能打开浮窗；滚动可能把新锚点移到静止指针下再关闭提示。显式移出后重新进入后，库存/装备槽浮窗内容检查通过，未修改产品浮窗逻辑。
- 同 tick 灼烧夹具首次误以为中立可受超过 100 的单次灼烧伤害。正式引擎保留中立 100 上限；改为明确 100 当前 HP 的边界输入，继续要求第 20 tick 同时致死，不修改机制或把 40 tick 当预期。
- 帮助页遗留“野怪掉落尚未开放”已修正，并增加 M7 旧档只读保全/原样导出说明；桌面脚本检查这些文案。

- 临时装备回放在与 U3 浏览器并行时首次触发原有 5s 超时（85 通过、1 超时）；停止浏览器后同一命令全部通过（新增 HP 向量后为 94/94），没有修改超时或断言。

- U3 受控 404 首次误断言失败图片仅隐藏，实际产品会移除失败的 img、保留类型色块与文字；据实际既有回退合同修正为“真实 404 请求 + img 被移除 + 正确文字占位”。

- 桌面脚本首次把 D/F 原生 repeat 错写为只提交一次；`M5_RULES.md` 的既有合同要求每次 repeat 同步提交。修正为两次公开命令的精确顺序结果，保持产品原生按键语义。

## 尚需外部验收

独立审查、硬件桌面性能（若当前环境为软件图形）与用户试玩不能由作者自我签收。
最终 CI、完整测量数字和源码/证据绑定将在候选冻结后补入；空白项不算通过。
