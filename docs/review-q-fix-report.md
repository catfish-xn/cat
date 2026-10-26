【完成】已按用户方案 A 修复 Review-Q 两项漏洞；分支 codex/v24-shopport2、HEAD 8aace6181f47d0a0ccc0b97ce94905cad95db6c4 未改变，未提交；未提供具体 -o 路径，报告更新于本文件。未删除断言或提高超时，Vitest 均 --maxWorkers=4，种子扫描始终最多一个进程。
【完成】新增按需 shopHistory（显式 shop-history-v1），记录取得边界、回合/等级/XP、生成原因、免费额度 choiceId/ordinal、付费价格、星夜随机命中、报价/购买星级和共享池库存；src/simulation/shop-history-types.ts:4、src/simulation/shop-history.ts:25、:62。
【完成】恢复重演逐次刷新与星夜结果，交叉核对 RNG、商店、资源购买/免费消费事实、金币收据和 Ticket 汇总；阻断计数+奖励、报价+结果、购买+单位+历史的联合篡改；src/simulation/shop-history.ts:96、:132、:223、:234，tests/shop-history.test.ts:37。
【完成】对象/JSON/serializeMatch 入口及权威共享池快照均认证；已重演战斗的商店历史前缀不可改写；src/simulation/serialization-structure.ts:313、src/simulation/shared-pool.ts:50、src/simulation/battle-record-validation.ts:178。
【完成】兼容策略已文档化：同 rules/content/digest 的旧无商店强化档原样恢复；旧商店强化档缺历史明确报 legacy shop augment saves cannot be authenticated，拒绝猜测迁移；docs/MATCH_CONTRACT.md:1429、tests/shop-history.test.ts:88。
【完成】对 HEAD 原代码与当前代码执行相同真实无商店强化路线，11 个序列化快照逐字节相同；两份 SHA-256 均 bcfa75d57a85c30ca69ead3af8a4af0d97959f92eb7dac9de583b34e5d98b765；证据 /tmp/shop-byte-baseline.json、/tmp/shop-byte-current.json。
【完成】沿用条件式认证证据规则，不升 schema/save/replay/command（12/8/8/7），不改 rules/content/digest；规则联机版本5、独立 WS 封套6亦不变。仅缺历史的商店强化存档及其战斗 context 需重新录制，无此强化的 golden/oracle/回放不需重录；src/simulation/m8/version.ts:11、docs/MATCH_CONTRACT.md:1431。
【完成】实际改动调用点全部列于 docs/MATCH_CONTRACT.md:1433；单人 buy/select/XP/lock/reroll/入轮/异常费用、共享生成/订阅/淘汰均确认。src/server/room/room.ts:171、:178、:180、:183、:541，src/server/net/messages.ts:249，src/rendering/match-session.ts:86 逐项确认无须源码改动，未越界修改服务器或界面。
【完成】真实命令覆盖付费/免费刷新、锁店、自然入轮、Dual Purpose、订阅、Firesale、二星购买、Room.handle、共享池恢复续算、M6 封套完整战斗历史、WS 白名单；tests/shop-history.test.ts:79、:97、:121、:132、:146、:177；原二星往返断言改用真实星夜取得夹具，tests/augment-pool-shop.test.ts:201。
【完成】最终指定验证：npx vitest run --project fast --maxWorkers=4 --configLoader runner --no-cache tests/augment-pool-shop.test.ts tests/shop-history.test.ts tests/restore-audit/*.test.ts tests/m6-persistence.test.ts；459 项中 452 通过、7 项既有失败，85.68 秒；商店/新增历史/M6 共120项全过。npx tsc --noEmit -p .、git diff --check 通过；日志 /tmp/review-q-final-tests.log、/tmp/review-q-final-typecheck.log。runner/no-cache 仅避开只读缓存目录。
【未完成】未修复此前已记录的7项无关基线失败：tests/restore-audit/corrosion-contributions.test.ts:12 的 seed=6 无 corrosion（5项）；tests/restore-audit/cd-replay-facts.test.ts:243 经 :33 期待 Mirror 错误，先遇 G23 health binding 错误（2项）。没有削弱断言，完整审计集仍非全绿。
【需要我决定】无；本次已按授权 A 实施，无新增玩法或版本取舍。
【风险】持有商店强化的旧档必须重开/重录；历史随真实命令增长。认证证明规则一致性，不是文件签名，无法辨别被整体改写为另一条完整合法轨迹的作者；共享快照仍要求外部权威池。边界见 docs/MATCH_CONTRACT.md:1427、:1429。
【下一步】请 Claude 按目录/契约交叉验货，并分别修复上述7项基线失败后再决定合并；当前工作区保留全部改动，未提交。
