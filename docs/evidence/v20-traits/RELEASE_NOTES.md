# v20-traits

迅击战士移动×1.5并在4档当前目标阵亡后下一tick合法冲刺；野火帮120tick周期、20tick无限射程窗口、4档+350%攻速（工程取值）、实际HP承伤回血和2格撤离。五组对应强化解锁军事管制、重新联合、天才、危险人物、意外搭档，包含唯一伙伴冻结、独立协同伤害、希尔科召唤快照及钢臂非三重10%转三重。

**以上七项执行均为用户批准魔改，源数值归档仍14.24b。** 完整数值、基底、舍入、附效排除、RNG、API与恢复边界见 [V20_TRAITS](../../V20_TRAITS.md)。

独立身份 v20-traits，schema/save/replay/command＝10/6/4/4；旧档拒绝，无迁移。与并行PR #373的v20-chem-baron分开，后合入者重录。v19证据与g2-4b manifest保留原字节。不部署、不联网、不写Git。

规则恢复与手算合成测试为 `tests/v20-traits.test.ts`；录制/核验入口 `scripts/verify-v20-traits-epoch.cjs`，输出 `epoch-verification.json`。表现层待Claude按V20_TRAITS末节去掉对应“暂未实装”；本包不修改界面文件。

## 验收（2026-10-22）

- 新增35项合成测试通过；相关18文件共345项均有通过证据。批跑其中2项触及原5000ms时限，录制结束后以原时限串行复跑对应两文件39项全部通过，未放宽时限。
- 身份/134个文本与对象恢复检查点、四路线golden及C19输入回归共164项通过；最终v20-traits身份与各审计字节绑定再次通过。`tsc --noEmit`、`git diff --check`通过。
- epoch 12项全部退出0；157个v15–v19历史文件与g2-4b manifest字节不变。完整记录见 [validation.json](validation.json) 和 [epoch-verification.json](epoch-verification.json)。
- CONTENT=`fnv1a32-utf16:f9581e38`，LOOT_REPLAY=`fnv1a32-utf16:3332bffa`；完整根从基线源码与当前源码离线独立重算吻合。未联网、未执行Git写操作、未部署；表现层名称/说明交接见V20_TRAITS末节。
