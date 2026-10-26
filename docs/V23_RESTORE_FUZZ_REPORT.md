【完成】新增确定性短测与完整比较器：`tests/v23-restore-fuzz.test.ts:10`、`tests/fixtures/restore-fuzz.ts:45`、`:64`；比较完整 state/RNG/events/receipts，保留三入口独立失败。
【完成】离线驱动 `scripts/fuzz-restore.cjs:17`、`:33`、`:119`：4 进程、4 种子、9 场完整对局（random/cannon/sniper/mage/BotDriver），92424 步、3051 检查点、9153 入口尝试、275226 次续跑比较；63 次拒绝、无续跑分歧，驱动按约定退出 1。
【完成】覆盖准备期 88、战斗中途 2951、结算 11、选择 1 个检查点；原始明细与每次失败到回归的映射见 `artifacts/v23-restore-fuzz/results.json:1`；命令 `node scripts/fuzz-restore.cjs --checkpoints 2000 --workers 4 -o /tmp/v23-restore-fuzz-final.md`。
【完成】F1：21 次入口拒绝→seed=2036、step=1282、round=6、tick=109；布里茨技能（`src/simulation/combat-g2.ts:91`）经新机制写 identity.key（`src/simulation/m8/s13-mechanisms.ts:74`），恢复声明分支排除了 ability（`src/simulation/m8/restore.ts:49`），误走旧前缀认证并在 `:101` 报 status display identity。
【完成】F2：42 次入口拒绝→seed=1039、step=7138、round=19、tick=122；艾克减魔抗（`src/simulation/combat-g2.ts:98`）的贡献到期为 null，显示到期投影为 1201（`src/simulation/m8/s13-mechanisms.ts:76`），同样误入旧分支，在 `src/simulation/m8/restore.ts:99` 的直接到期相等检查报 status source/timing projection，之后亦涉及 F1 的键格式。
【完成】两类均缩减为“合法前驱＋一次 stepMatch”，三个入口接受前驱并产出相同结果（`tests/v23-restore-fuzz.test.ts:51`），各入口的期望恢复/续跑断言记为 6 个 it.fails（`:58`）；最小复跑参数见 `:38`、`:39` 及上述 JSON 的 regressions。
【完成】真实 Room 席位被既有入口明确拒绝（`src/simulation/serialization-structure.ts:150`），额外 213 次联机拒绝未计入 3051；seed=42、step=0 的正向契约回归见 `tests/v23-restore-fuzz.test.ts:67`。现有 BotDriver 经单人薄适配转发公共命令（`scripts/fuzz-restore.cjs:33`），未剥离联机字段冒充单人存档。
【完成】定向测试命令 `npm test -- --configLoader runner tests/v23-restore-fuzz.test.ts`：10 passed、6 expected fail，退出 0；`npm run typecheck`、`node --check scripts/fuzz-restore.cjs`、`git diff --check` 均通过。未运行全套测试，未添加超时或放宽断言。
【完成】工程约定已记为 P（2026-10-25）：`docs/S13_RULES_GAP.md:1017`；基线 dd9815e6，未修改 src、版本/身份、保存格式、冻结证据或旧夹具，未提交。
【未完成】F1/F2 的生产修复；本任务明确禁止修改 src。调查、最小化、回归和长跑均已完成。
【需要我决定】无，未决工程口径已按推荐落在 P 中。
【风险】合法布里茨/艾克技能状态仍可能无法存取；随机覆盖不等于证明所有状态。真实联机 Room/席位存档仍不属于现有 API 契约。
【下一步】另项修复技能声明状态的来源/重放认证与正确投影，保留校验强度，再将 6 个 it.fails 转为普通测试并复跑长测。
