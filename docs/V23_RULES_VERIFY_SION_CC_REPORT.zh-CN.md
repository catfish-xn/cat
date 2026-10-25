【完成】新增 tests/v23-rules-verify-sion-cc.test.ts:61，34 项独立验证；基础面板、四档双抗、逐星增长、法力、攻速和射程通过。
【完成】主动护盾/线晕见 tests/v23-rules-verify-sion-cc.test.ts:81；五次真实施法与 65% 严格边界见 :116、:132。
【完成】冲锋最近目标、多目标命中、100% AD、10 tick 击飞及仅命中目标 8% 增伤见 tests/v23-rules-verify-sion-cc.test.ts:138、:160。
【完成】五档解缚补满生命/+100 AP、七档一次复活/20 tick/75% HP、+300% AS/40% 吸血及结束前免控见 tests/v23-rules-verify-sion-cc.test.ts:177、:187、:206、:223。
【完成】安蓓萨 20 tick 晕、蔚同排 10 tick 击飞、范德尔无嘲讽与 20 tick=1000 ms 见 tests/v23-rules-verify-sion-cc.test.ts:243、:260、:278。
【完成】P（2026-10-25）测试隔离、取整与合成靶子口径记于 docs/S13_RULES_GAP.md:1015；未修改 src、保存格式、身份、证据、夹具或 Git 元数据。
【完成】npm test -- --configLoader runner tests/v23-rules-verify-sion-cc.test.ts tests/v23-review-sion.test.ts tests/short-cc-durations.test.ts：3 文件、43/43 通过（新增 34 项）；npm run typecheck 与 git diff --check 通过。
【未完成】无；未发现用户清单与实现不符，无须保留 it.fails；按要求未运行全量测试，未提交。
【需要我决定】无；未提供具体 -o 路径，中文报告保存在本文件。
【风险】冲锋多命中采用同格合成靶子（tests/v23-rules-verify-sion-cc.test.ts:140），用于路径循环覆盖，不证明准备期可同格部署；默认 Vite 配置加载会写只读 node_modules，定向测试使用 runner 加载器绕过，无配置修改。
【下一步】由集成负责人审阅并纳入 v23；未来实现偏离时保留独立期望，按任务要求改为带原因注释的 it.fails。
