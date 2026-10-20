# 双排原型（未完成，生产池不注册）

历史正常空席专项曾1/1通过，不能证明满席合法性。`duo-queue-acquisition.ts.txt` 是撤出的未验证实现：它以缺receipt视为可再领，删除整组receipt/birth/unit可能重新授予，不能采用。

正确方向：选择时两个种子确定的奖励都取得唯一所有权，满席持有真实unitId的独立容器；共享池在选择事务占用一次，腾位时只移动同一实例，必要升星以真实消费事实结算，不重复生成。

现有边界：`src/server/room/room.ts` deploy路径是plain命令；PvP只锁定阵容而不调用startMatchCombat。因此单纯“下次start再补发”不能覆盖PvP。满席领取如发生升星需要shared pool事务，不能在plain deploy里隐式改pool holdings。本任务不允许修改server。需新的共享领取/部署事务与Claude适配，不能保持半实现可选项。
