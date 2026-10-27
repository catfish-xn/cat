【完成】基线 `codex/ci-flake-3@30690fe3`；核对最近 60 次 CI、20 份失败日志和 5 份 v23-fast JSON，移植旧分支最终 `adf5c5e5` 的适用修复；共改 20 个测试文件，逐条原测试名、红/绿证据、根因及修复见 [候选清单](CI_FLAKE_3_CASES.md)。
【完成】`r3r4-oracle` 将重复 oracle 计算缓存为每 seed 一次，512 seed 全留并拆 16 组；`augment-text-identity` 双入口分别打包验证；`assets3d-merge`、`assets3d-fx-pilot` 同步准备小夹具，保留真实异步合并和散列断言。
【完成】`m5-route`、`g2-3-identity`、`g2-3-lesser-shimmer-duplicator`、`m8-b8-equipment-fixture`、`m8-b8-live-capacity`、`restore-audit/g23-grant-evidence` 将长路线改为消费套件内有序分段 hook，消除预热测试顺序依赖；真实回合、购买、奖励及资源断言保留。
【完成】`chest-bracer-integration-trial`、`restore-audit/bounds-preflight` 按恢复入口拆例；`b8-resumable-battle-helper`、`g5-combat-summary` 按篡改类型拆例；完整状态、事件、RNG、终止切片和拒绝断言保留。
【完成】`server/bot-driver-helper` 分轮推进两条独立对局和断线场景；`server/net/watch`、`server/projection-wire` 分离开服/连接准备；`server/net/combat-stream-wire` 用具体消息和 inbox 游标替代固定睡眠后的解引用，保留真实 socket 与完整比较。
【完成】`rendering3d-preload-mount` 文件级加载模块、每例清理资源；`presentation/hover-card-pin` 拆分 hook，并每例新建独立 BrowserContext，消除删除行/鼠标/卡片共享状态；基线已有的 `unit-panel`、D11 seed 预筛、M5 replay 分段和 Placebo 合法节点修复沿用。
【完成】19 个非浏览器文件最终版本均通过 `--maxWorkers=4` 普通三遍及 `--sequence.shuffle --sequence.seed=27102026` 一遍；整组每轮 248 条，零失败/跳过；三个类型修订文件另补跑 32 条全过。命令、临时配置、逐文件结果及 SHA-256 见 [验证清单](CI_FLAKE_3_VERIFICATION.json)。
【完成】`npx tsc --noEmit`、`git diff --check` 通过；未删验收断言、未提高超时或放宽 gate、未改 src/规则/golden，未提交。只用于推进路线的预热用例改成 hook，因此条数下降；原获取成功断言仍执行。
【未完成】`hover-card-pin` 尚缺三遍及 shuffle 浏览器验证：当前没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，按本次 AGENTS 浏览器连接约束未自行启动 Chrome；Node 验证临时配置只替换无条件启动浏览器的 global setup 为原文件缓存准备，不改变 worker/setup/隔离/测试门槛。
【未完成】`hover-dom` 只存在于未合入前端分支，已检查源码并记录未暂停 page clock 与异步触摸边界的推断，未引入该文件；真实浏览器性能预算失败未作为测试 flake 放宽或改写，未运行浏览器脚本。
【需要我决定】无；没有玩法或接口取舍。
【风险】跨开发提交的先红后绿不全是 flake；27 条本地超时/异步候选中 22 条本次处理、5 条基线已有修复，其余数值/身份变化未据此修改。有限的 4-worker 复跑不能保证任意机器超载下仍通过。
【下一步】由 Claude 用 `codex-browser exec` 新启动任务，复用共享浏览器补验 `hover-card-pin` 三遍及 shuffle；再按测试、目录边界、玩法三项交叉审查并纳入 multiplayer。
