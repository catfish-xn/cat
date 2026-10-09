# H1 同运行多快照分析方法

`scripts/diagnostics/analyze-h1-snapshot-series.py` 是独立离线解析器，不替换原测量脚本。按时间顺序传入多个 `--stage 标签 路径`，另给 `--runtime-sha`、`--browser`、`--run-url` 和 `--output`。输入支持原始JSON或gzip，输出名以.gz结尾时使用固定mtime的gzip。调用者元数据必须与artifact manifest/environment核对，不能因参数填入就视为已验证。

- 保存输入文件SHA256，按metadata字段名解析，拒绝重复字段、损坏数组、重复ID、负数字段、越界索引/目标及未知edge kind。
- 排除weak、ephemeron-table条件边及编号WeakMap key→value条件边；未知条件关系格式失败。分类器、BFS、计数、路径验证共享函数。
- 输出每阶段按type/name及互斥type的count/self-size（含减少项）；相邻区间及首末差验证可加性。extra_native_bytes只保留原字段，不与self_size或Runtime.usedSize相加。
- 各区间挑选code/native/object/array/closure中正self-size或count增长靠前的组，按ID未见、同ID同标签、同ID变标签分组，保存实际根链。ID分类只是同profiler会话内描述，不普遍证明分配/存活/复用。
- scene/session按属性集合识别候选，报告全部候选及属性/根路径；需要再用真实scene.session及debug路径确认，不能把minified类名当永久标识。
- native Performance动态定位全部候选，报告全部传入边及分类，并给出含/不含shortcut的根路径。shortcut为根别名；路径不是dominator、独占所有权、retained-size或泄漏证明。
- object/closure/array不是“应用独占”分类；路径可同时经过浏览器和工具根，不能作互斥归因百分比。剔除条件边后不可达也不等于垃圾。
- 快照会扰动执行；此组不与无快照正常样本混算。若只读before/first/final，不能凭三点宣称中间各窗持续增长；结合该次窗口日志与独立无快照组说明。

## 可复现检查

运行 `python scripts/diagnostics/check-h1-snapshot-parser.py`，31项合成检查结果存放在 `docs/evidence/h1-parser-checks/synthetic-checks.json`。覆盖条件边、弱边、独立强路径、gzip/plain、字段重排和损坏输入拒绝。它是离线诊断自检，没有加入或改动现有CI/必过测试。

旧141原始快照回归：before/after节点253,958/259,473，严格图可达253,364/258,879，self-size20,885,334/21,955,838，净增1,070,504 B；code净增878,904 B；每阶段scene/session候选各1、native Performance各1。与修正后的既有报告相符。CI153结果必须另读新artifact，不能继承这些对象ID或数值。

条件边格式依据：Chromium153.0.8010.12的[DEPS](https://raw.githubusercontent.com/chromium/chromium/153.0.8010.12/DEPS)固定V8 `0b60d2b01800d7ba2c6eeb5e51ecd95f6dab44c7`；对应[heap-snapshot-generator.cc](https://raw.githubusercontent.com/v8/v8/0b60d2b01800d7ba2c6eeb5e51ecd95f6dab44c7/src/profiler/heap-snapshot-generator.cc)的CreateEphemeronEdges与SetNamedAutoIndexReference生成带对象/编号的条件边。仍须以实际快照词汇核对，不把版本号当解析成功证据。
