# H4 独立奖励 oracle 修复报告

日期：2026-10-27。基线：`codex/v25-h4`，`99350923649069dff9ae2c3c2781086b9a5dda60`，开工工作区干净。
对应审查：`/home/aiapps/workspcae/codex-briefs/b5h/review-h4-result.md` 的 P2 must-fix。

## 完成内容

- `augment-rewards-oracle.cjs` 的应付计划、来源检查和金币账本接入 H4；`oracle.g2.cjs` 通过原有 `validateRewards` 调用获得独立金额，注册表本来已包含三个 H4 身份，无须再扩池。
- 新增 `h4-rewards-oracle.cjs`：多元化投资两个版本按每个后续自然轮的冻结入轮棋盘及装备重新统计非唯一激活羁绊，支付 `floor(n/3)`，不累计余数、不补取得轮。入轮事实还与命令前的真实棋盘、装备逐项比对。
- 幸存者从取得事实及完整八席淘汰事实确定首次应付 60 金；取得时补发、先完成整桌淘汰、持有者必须存活、入轮桌况不触发付款。全桌结算使用独立 oracle 命令 `{ type: 'recordAugmentSettlementTable', seats }`，将记录与调用方提供的桌况逐项比对。
- 核验完整历史付款集合及新增付款的金额、来源、轮次、收据身份、唯一性和编号事件；过去收据也须先符合独立计划，不能用伪造的已付收据屏蔽应付奖励。全桌结算另核验实际金币差额。
- 补充漏发、多发、重复、错金额、错轮次、改收据身份、丢失／重复／错序事件、棋盘与桌况共伪造、已付历史篡改、非结算命令发钱等负例。
- 可选项一并补齐：两个版本真实八席房间的公开选择、购买、部署、入轮付款、断线重连、对象／JSON 权威恢复及反篡改；既有流式／非流式幸存者真实对局付款也接入独立 oracle。
- 羁绊边界包括转职、未装备／替补／敌方不计数、同名棋子去重、唯一羁绊排除、外交官 1/2/3/4 人、5/6 条激活羁绊、团队强化及补给轮。关键边界同时调用生产 `portfolioGoldPlan` 与独立 oracle，对照手写预期。
- 原有总数与唯一性断言从过期的 235 同步为目录现有的 238，保留断言并新增三个 H4 银色身份检查。

## 独立性与数据来源

`h4-traits-oracle-data.cjs` 从已留存的 14.24 CDragon 原始资料 `augment-crossversion-research-2026-10-24/raw/common/14.24-tft-en_us.json` 提取英雄原生羁绊、激活门槛、唯一羁绊及纹章映射，只转换项目身份别名。原文件 SHA256：`c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3`。

付款公式与时点来自 `docs/AUGMENT_BATCH5_GAPS.md` 的 P-B5-32/33/34；团队强化补充现有项目成员约定。两个新增 CJS oracle 文件不导入生产代码，不调用生产羁绊投影／奖励计划，不将生产收据、保存的羁绊计数或奖励金额当预期。测试运行不依赖外部研究目录；新文件自动纳入现有 oracle 源码摘要检查。

## 验证

最终相关测试 **4 个文件、213 项全部通过**：

| 文件 | 项数 |
| --- | ---: |
| `tests/augment-pool-batch5-h4-oracle.test.ts` | 33 |
| `tests/m5-oracle-augment-ledger.test.ts` | 43 |
| `tests/server/batch5-portfolio-room.test.ts` | 23 |
| `tests/server/batch5-survivor-room.test.ts` | 114 |

运行命令：

```sh
npm test -- --configLoader runner --config artifacts/h4-oracle/vitest.config.ts \
  tests/augment-pool-batch5-h4-oracle.test.ts \
  tests/m5-oracle-augment-ledger.test.ts \
  tests/server/batch5-portfolio-room.test.ts \
  tests/server/batch5-survivor-room.test.ts
npm run typecheck
git diff --check
```

共享 `node_modules` 为只读，默认配置打包会报 `EROFS`。本次使用 Vite runner 加载配置；`artifacts/h4-oracle/vitest.config.ts` 导入项目原配置，仅清空此次无浏览器测试所不需要的 `globalSetup`，其余测试设置、断言与超时不变。真实房间按自然轮拆分测试，补给轮直接等待结算；没有增加超时。

`npm run typecheck`（`tsc --noEmit`）及 `git diff --check` 均已通过。

## 范围与后续

仅改动 `tests/` 和本报告，没有改生产规则、服务器、界面、golden 或内容版本；未执行 Git 写操作。未跑全量、浏览器、构建或单机完整对局验收，符合本次范围。测试夹具是固定 14.24 数据；未来内容变更应同步独立夹具并保留来源核对。建议按原审查入口复审 P2。
