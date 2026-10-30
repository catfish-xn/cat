# v26 纪元重录（半成品，2026-10-30 停在交接）

基于 cursor/v26-integration bc818fd8。已执行 `node scripts/update-content-identities.cjs --write`，然后 `node scripts/verify-v25-epoch-parallel.cjs --write --jobs=6`，herald 录制进行中被手动停止（交接给 Cursor）。

已写入（本提交）：identity-constants、v25-online-rules-transfer-route、server battle-start fixture、battle-start-audit。herald 未完成，其余步骤未跑，校验（不带 --write）未跑。

失败的两步（日志见 V26_EPOCH_WIP.log.txt 和 artifacts/v25-online-rules-recording/*.log）：
- record-release：scripts/record-v25-online-rules-release.cjs:22 断言 rulesVersion 必须是 s13-g2-3-v25-online-rules，实际 s13-g2-3-v26-neutrals-1424。v26 需要自己的 release 录制脚本或调整这条断言（参照 v24→v25 当时的做法）。
- record-live-reveal：脚本 :24 deepStrictEqual 失败，4-7 razorbeaks 死亡顺序因战斗漂移（近战寻路/P1）改变。

下一步：建 v26 纪元脚本或改上述两处，重跑 --write 全部步骤，再不带 --write 校验，然后 audit/herald/identities --check。
