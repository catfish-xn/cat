# ②失败闭环（逐根因追加，非最终验收）

起点为固定75c8/CI183的15文件92失败。既有①签收、CI174首失败、CI183原结果保留；后续代码须新SHA CI，不能引用旧结果替代。

## 批次A：旧phase与重复开场发奖（7项）

- B6弃权：旧m8整对象不变改为严格其余字段不变、所有当前未赚direct/choice按独立预期forfeited；仍保原2/3/5G、2/2/0XP、3HP、固定plan/RNG及round-trip。
- B6/B7开场：真实1-3自选先验证Continue wrong-phase且state同引用，通过公开选择后仍保原settlement/finished与完整restore检查。
- B7四seed：删除额外手发unit2/3，改验证实际Maddie/Lux一星和唯一receipt，再公开部署；10G/3级0XP/100HP保持，组件按已批准两次真实sword选择与零ScheduleReceipt精确核对。
- 原日志`phase-opening-seven.log.gz`：使用测试名称过滤，选中的7项全部通过；另外39项只是此次filter未执行，**不是新增skip、不是整个B6/B7文件通过**。原文件未增.skip/timeout/worker修改。余下强阵容来源恢复尚待下一批。
