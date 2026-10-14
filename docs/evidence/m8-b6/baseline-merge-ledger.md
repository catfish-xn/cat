# 最新 baseline 同步与共享脚本核对账本

用户2026-10-09明确允许把最新baseline同步进B6，保留H1告警政策和精确B8/B9跳过，冲突一起送独立审计；未授权B6合回baseline。

## 固定纯合并

- fetch核准baseline：`adf24b4ef6f5ec65b3abd59adc050ad2b6b82880`，含H1 `f90e438933f341938c238980e1249d8904468c53`及U3 PR19。
- GitHub纯merge提交：`e86b0ac07b53a799f80b25da6009366217cb7a5f`。
- 第一父：`88efdc443e3641dc96c1fb4d90442a4d0edab913`；第二父：`adf24b4ef6f5ec65b3abd59adc050ad2b6b82880`。
- tree：`1589b35ae29b652193fcd3a3f0df7d8c75570e01`。本地临时merge `8e6c69740107d0bf4db558748a28d8861542a6ae`与该远端提交parents/tree完全一致，远端认证身份/提交时间导致commit ID不同。
- `--no-ff --no-commit`后由单独merge commit保存，没有rebase。纯merge不含后续U3准备适配或本账本文档；**文本冲突0个，无手工冲突裁决**。

## 自动合并的共享文件（两方意图与最终保留范围）

| 文件/现行行段 | baseline意图 | B6意图 | 解决方式与核查 |
| --- | --- | --- | --- |
| `scripts/verify-m5-browser.cjs:11,31–58` / `:117,134` | H1：实际post-GC字节/门槛保留；普通完整应用heap超限改为warn-only；实验模式原阈值仍硬检查；监听器与RAF原断言仍硬检查 | 保留容量内30战与B9精确尾3战/完整终态skip及部分覆盖说明 | Git自动合并两个独立行段；全部保留，未改数值门槛、采样/预热次数、UI或B9集合。无手工修改该文件。 |
| `scripts/compare-m6-evidence.cjs:7,46–50` / `:107–138,141–197` | H1：从原始before/after重新计算heapGate，严格核对元数据，再输出warning；资源/身份检查不降级 | B8/B9应用及精确四性能skip透明消费，其他数字门禁与独立30战真实导入仍硬检查 | Git自动合并独立行段；H1只影响原完整应用heap，不影响模块heap预算或bounded导入；双方断言全部保留。无手工修改该文件。 |

其余13个baseline改动文件原样引入，包括H1 helper/两测试/政策文档及U3视觉、样式、CI新增job/文档。对baseline的`src/rendering/`、`src/presentation/`、`src/style.css`、`.github/`、H1 helper/测试全文diff为空。未把它们算作B6新设计。

## 合并后验证与独立后续适配

- Node22：H1两个文件及B6边界/性能元数据两个文件，4文件37测试通过；typecheck通过。日志`checkpoint8-merge-{targeted,typecheck}.log.gz`。此为纯merge tree的定向结果，不是全量CI或独立签收。
- 新U3脚本旧setup假设新局即有三英雄及2-1。B6新局只有unit-1，原部署unit-2/3会失败。经确认，仅在后续独立提交适配`scripts/verify-m8-u3-dynamic.cjs:63–81`：真实公开命令走完1-2/1-3/1-4，到2-1选原首offer、购买麦迪/拉克丝，再走原部署和原7物品fixture。
- 原10场交互从首个`await check('drag-tg-holder'...)`开始至文件末尾与baseline逐字相同，原2-1临时装备文案也未改；没有跳U3用例、改UI或改时间/阈值。
- 直接提取**实际U3脚本setup代码**在Node调用生产API：empty/tg/occupied/full/unique五种准备均为真实2-1、3级、8G、unit-1刀妹/unit-2麦迪/unit-3拉克丝，位置仍(1,4)/(3,4)/(5,4)，7件原fixture装备；TG准备2件临时装备。代码与日志`checkpoint8-u3-fixture-diagnostic.cjs/.log.gz`。
- 该诊断只证明准备代码合法、原交互代码不变；本机没有运行Chromium，不宣称10场实际原生输入已通过。待新固定SHA CI和独立Pro一起审查合并及适配。
