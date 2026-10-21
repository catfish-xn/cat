# PR #373 第二次同步：v20-traits 父 epoch

基线 `ce60a8b9dd2b0c3a0c34c527405d44939233fb5b`，工作分支 `codex/chem-baron-fix`。未联网、未 push；Git 元数据只读，冲突内容已解决，索引仍需用户登记。界面目录没有新增工作区修改，合并前已暂存的界面改动保持原样。

## 版本与保全

- 当前 epoch `v20-chem-baron`，父 `v20-traits`；CONTENT `fnv1a32-utf16:2d1eafb8`，LOOT_REPLAY `fnv1a32-utf16:7fd08770`。
- schema/save/replay/command 从父 10/6/4/4 改为 11/7/4/4：黑市候选 `optionIds`、领取收据 `optionId` 是新增存档字段；战斗回放与命令协议不变。旧身份拒绝，无迁移。
- 220 份历史文件及受保护 manifest 与基线字节一致。迅击、野火、搭档、共用移动判定、66 强化相关 10 份运行时文件与父提交字节一致，见 [保全记录](sync2-preservation.json)。
- 当前 golden、134 个 cannon/sniper 检查点、B8/C19、Herald、transfer 与 live-reveal 都在当前规则下重新运行公共输入，不改历史存档版本字符串。

## 验证

原始命令、日志与 JSON 在本地忽略目录 `artifacts/v20-chem-baron-sync2/`，epoch 各步日志在 `artifacts/v20-chem-baron-recording/`。epoch 11 步均通过（540.443 秒）；三份源审计各 363 个哈希与最终源码一致。专项 58 文件 / 1396 项全部通过，另行核心 6 文件 / 299 项通过（与专项重叠，不叠加）。完整 fast 四片为 485 文件、6384 通过、53 环境失败、0 跳过，无计时或规则断言失败；本目录 validation.json 已更新为本次结果；完整分片分类见 [fast 报告](FAST_TEST_RESULTS.md) 和 [机器清单](fast-failures.json)。

U6 使用实际公共命令创建 capacity 与 terminal 存档，验证 34 场战斗历史，并在监听前独立执行结算：两名英雄等待容量、终局 Gangplank 保留的断言通过。随后 `listen EPERM 127.0.0.1:5173`，未执行任何 DOM 检查，不能计为 U6 通过；需在允许本机监听的环境执行同一命令。没有跳过断言或提高超时。

当前 epoch 工具使用普通文件描述符捕获子进程输出，解决此沙箱同步管道的 EPERM；错误退出仍中止流程。不加载预加载器、不修改历史录制脚本。

四片并发的首次尝试在可用内存仅 175 MiB 时主动中止，未计入完整四分片结果；日志保存在 `artifacts/v20-chem-baron-sync2/aborted-four-concurrent/`。随后改为每批两片、每片一个 worker，无超时调整、无过滤或跳过，四片均从完整分片入口运行。

独立压力复核发现继承的真实性能门槛失败：相同 Node 24 环境、独立源码 bundle、测量子进程无预加载器时，父 v20-traits RSS 为 282868 KiB，当前为 284088 KiB，均超过 262144 KiB（256 MiB）。两者 AP 301 个、范围 100–700、AD 271 个，耗时分别 45.6/49.2 ms，正确性与耗时通过；不能将该内存门槛计为通过，也不是本轮新出现的玩法差异。见 [同条件对比](sync2-memory-comparison.json)。

冷进程恢复的原始分片失败为同步管道 EPERM；只将输出换为普通文件描述符，使用原超时、原 4/10/14 档存档和相同断言单跑，1/1 通过（10 项未选择）。原分片结果不覆盖。该复核使用忽略目录内预加载器，不用于完整四分片或独立内存比较。
