# v20-traits

迅击战士移动×1.5并在4档当前目标阵亡后下一tick合法冲刺；野火帮120tick周期、20tick无限射程窗口、4档+350%攻速（工程取值）、实际HP承伤回血和2格撤离。五组对应强化解锁军事管制、重新联合、天才、危险人物、意外搭档，包含唯一伙伴冻结、独立协同伤害、希尔科召唤快照及钢臂非三重10%转三重。

**以上七项执行均为用户批准魔改，源数值归档仍14.24b。** 完整数值、基底、舍入、附效排除、RNG、API与恢复边界见 [V20_TRAITS](../../V20_TRAITS.md)。

独立身份 v20-traits，schema/save/replay/command＝10/6/4/4；旧档拒绝，无迁移。与并行PR #373的v20-chem-baron分开，后合入者重录。v19证据与g2-4b manifest保留原字节。不部署、不联网、不写Git。

规则恢复与手算合成测试为 `tests/v20-traits.test.ts`；录制/核验入口 `scripts/verify-v20-traits-epoch.cjs`，输出 `epoch-verification.json`。表现层待Claude按V20_TRAITS末节去掉对应“暂未实装”；本包不修改界面文件。

## 验收（2026-10-22）

- PR #379 修复：危险人物屏蔽爆爆的家人彩蛋额外星级，同时保留家人计数、其他成员升星与阵亡降星联系。普通移动、迅击与野火复用同一禁止移动判定；野火在当 tick 控制/引导维护后执行，受阻仍开窗、回血并清空承伤桶。
- 新增20项组合回归，v20合成测试共55项；规则相关11文件共287项通过。身份/134个文本与对象恢复检查点、四路线golden及C19输入回归另164项通过。`npm.cmd run typecheck`、`git diff --check`通过。
- 同一次修复只调用一次 epoch 入口，统一重录release、Herald、输入、转移与live reveal，12项全部退出0；157个v15–v19历史文件及g2-4b manifest字节不变，两个digest根离线独立重算吻合。结果见 [epoch-verification.json](epoch-verification.json)，测试与范围证据见 [validation.json](validation.json)。
- CONTENT=`fnv1a32-utf16:8bbf3521`，LOOT_REPLAY=`fnv1a32-utf16:77e577f1`。旧digest存档按既有规则拒绝恢复。未联网、未执行Git写操作、未部署、未修改表现层。
