【完成】前置：多锻造器及基础/成装/神器/辅助池、独立随机成装/单位流、两种复制器及消耗品通用发放、获得经验、每回合金币；唯一收据、满席待发、严格恢复和联机共享池接通。
【完成】A（20）：`item-grab-bag-i`, `one-two-five`, `band-of-thieves-i`, `teaming-up-i`, `iron-assets`, `missed-connections`, `ones-twos-three`, `silver-spoon`, `heroic-grab-bag`, `raining-gold`, `raining-gold-plus`, `big-grab-bag`, `teaming-up-ii`, `support-cache`, `duo-queue`, `two-trick`, `build-a-bud`, `radiant-refactor`, `final-polish`, `one-buff-two-buff`。
【完成】之徽（22）：`academy-crest`, `ambusher-crest`, `artillerist-crest`, `automata-crest`, `bruiser-crest`, `black-rose-crest`, `chem-baron-crest`, `conqueror-crest`, `dominator-crest`, `enforcer-crest`, `experiment-crest`, `family-crest`, `firelight-crest`, `pit-fighter-crest`, `quickstriker-crest`, `rebel-crest`, `scrap-crest`, `sentinel-crest`, `sniper-crest`, `sorcerer-crest`, `visionary-crest`, `watcher-crest`。
【完成】之冕（22）：`academy-crown`, `ambusher-crown`, `artillerist-crown`, `automata-crown`, `bruiser-crown`, `black-rose-crown`, `chem-baron-crown`, `conqueror-crown`, `dominator-crown`, `enforcer-crown`, `experiment-crown`, `family-crown`, `firelight-crown`, `pit-fighter-crown`, `quickstriker-crown`, `rebel-crown`, `scrap-crown`, `sentinel-crown`, `sniper-crown`, `sorcerer-crown`, `visionary-crown`, `watcher-crown`。
【未完成】`TFT_Augment_BranchingOut`：缺随机纹章候选池与权重，未猜数值、未入池。
【未完成】`TFT9_Augment_AllThatShimmers`、`TFT_Augment_AllThatShimmersPlus`：3选1、拆卸器、Plus 4金已有源值；生金神器池/InterestCap=5语义未认证，三选管线尚未接入。
【未完成】`TFT_Augment_Coronation`：已知30%AS/30%AD/40AP；完整描述同时强化Crown/Shield/Cape，Shield/Cape尚未实现，因此整项暂缓。
【未完成】`TFT_Augment_TacticiansKitchen`：Cape未实现、随机纹章池未定义；描述与NumSpatula/NumFryingPan/NumItemAnvils矛盾。
【完成】测试：新增129项（前置10、批次119），覆盖逐项身份/奖励/参数、44徽冕过滤、公共选择/恢复、黑玫瑰3-2、双锻造器逆序/超时、经验/金币、复制器消费及共享池守恒；强化相关17文件549/549通过，补充参数校验119/119通过；typecheck与git diff --check通过。
【需要我决定】随机纹章：A=现有22纹章均匀抽取，B=继续等原版候选池/权重；建议A，并明确记为项目约定后再开放Branching Out。
【需要我决定】锅铲厨房奖励：A=按解析描述“Cape+随机纹章”，B=按散落常量解释为铲/锅/锻造器；建议A，但先补齐Cape数值和行为依据；Coronation也待该物品能力齐备。
【风险】这是v23候选：content manifest已包含新数据，未改身份常量，发布前需统一v23身份/摘要；未重录、未改禁区、未提交。classification.json实际为25个A+22徽+22冕=69，按该清单交付64项、阻塞5项。
【下一步】审阅docs/MATCH_CONTRACT.md的新增接口与满席语义；补证生金池及InterestCap含义，再完成剩余5项。
