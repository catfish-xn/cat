# CURSOR_d5-register 执行报告

分支：`cursor/d5-register`（基于 `claude/v26-d5-register` @ 7953c99a）

## 改动

| 文件 | 行 | 说明 |
| --- | --- | --- |
| `src/simulation/augment-d1.ts` | 15–18 | 缺 D0 容错仅保留 `?pvp=placeholder` 形态：`settlementId === round-${round}-settled` 且无 receipt、无 `damageDealt` 时跳过；权威 PvP 收据（如 `4:D1`）缺字段或 receipt 不匹配仍抛 `Invalid D1 damageDealt authority`。 |
| `tests/augment-d1.test.ts` | 88–101 | 恢复 settlement 层拒绝：无 `damageDealt` 的权威收据 `applyRoundSettlement` → `{ ok: false, state: 原 state, reason: 'invalid-receipt' }`；保留 settlement 后篡改 roundResult/receipt 的 progress 抛错用例。 |

## 测试

```bash
npm test -- tests/augment-d1.test.ts --maxWorkers=4
```

结果：6 passed，1 skipped（独立 archive 用例）。

## 未完成（本任务范围外）

- D5 其余 WIP（四卡注册、阶段禁令等）已在基线分支，本次仅 D1/D0 权威边界收尾。
- 未跑全量 `test:headless` / server 占位房间套件（与改动直接相关的单测已绿）。

## 执行端待办

- 纪元统一重录（v25 epoch、content digest、recorded fixtures、opening-random-identity 等；勿本地 `--write` 重录）。
- 素材下载/提取/上传测试服（`ssh tencent`）、测试服部署。
- 浏览器/GPU 实机验收（codex-browser）。
- 审查并合并 `cursor/d5-register` → 集成分支（本任务未开 PR）。
