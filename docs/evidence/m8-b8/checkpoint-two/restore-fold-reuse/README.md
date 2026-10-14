# 单次恢复的完整资源投影复用：中间 WIP，尚未送最终签收

## 问题与最小范围

CI200固定c854的sniper replay执行182 commands /11930 ticks后耗时183.481s，超原180秒；原失败见 ../ci200-first-failure/。原每次running restore在validateB8Resources中对相同完整provenance/context连续fold两次；短历史prefix仍需要其独立全流校验。

本改动只复用**本次restore、自行JSON.parse得到的输入图、完整prefix、相同所有依赖**的已验证冻结投影。不是按ID缓存，也无跨调用缓存。所有对象入口统一保留原双fold；任何短prefix保留原路径。current不从函数返回、不在模块/全局存储，basis仍独立clone/freeze。

## 三个版本，禁止混用验证结论

1. 原版本：b8-restore/serialization来自src tree5f9b62228b236074efd78b50a571cc26d23858e5。完整原profile在before/，169个src hash各次运行前后不变。
2. 第一版局部复用：只按完整prefix复用，尚未区分object/string。after/的同负载profile，以及targeted/中的162组合/typecheck/136.60s正式sniper专项、初始3/3控制，都针对这一版。**该版随后发现accessor对象拒绝回归，不能以这些通过记录宣称正确。** 原源diff、bundle、source map及所有hash都保留，未事后改成最终版。
3. 当前保守修复：`validateB8Resources(state, parsedJsonInput=false)`，仅serialization收到字符串时传true；对象入口原双fold。新增两个首fold之后经persistentGrowth/preparation getter篡改ledger的拒绝负控。当前5/5专项通过（targeted/accessor-target.log.gz），但尚未重新做完整profile、162组合/typecheck、全量、预算及CI。此为待外部定向只读诊断的WIP，未签收。

当前文件SHA256：
- b8-restore.ts：5ca38841837fbfd093d91eab1775f273777d3a15d7e0091fc395caca9de010a5
- serialization.ts：af5fd2e21f2b4fb0ec3b32b1542d6e92ab09d58cf57376c1fe4f1e7afbf06cdc
- m8-b8-restore-fold-reuse.test.ts：6797fbebc6c994a4d09d3c624eeef460a4163af678cae7f149627ffffe4b138a

## 第一版前后量化（不是当前修正版验收）

Node22.23.3，原完整sniper测试工作量及全部逐步state/events比较、四种非法命令插入断言不变：
- 总143.476→139.151s；restore12112次不变、88.655→83.799s。
- fold24081→12151次，恰少11930个running重复fold；9.491→5.087s。
- receipt结构验证36193→24263；Loot/basis及其余插桩调用数不变。
- 最终完整JSON SHA256两者同为 d3a1a077f60bcd6201bcd166cb3447e546384deb39e09c1bdc0af672018617a8。

收益约4.326s/3.01%；不能保证CI同比改善，不把profile低于180秒当Vitest通过，更不掩盖第一版getter回归。没有B8前相同路线的profile，不能由这些数据量化整批B8恢复退化。

## 对象入口反例及修正边界

内部只读预检实际复现：raw.persistentGrowth getter在首fold后被读取时，给entries[0].source增加extra=1；第一版接受且返回extra，返回值再次JSON restore反而拒绝`Invalid resource provenance: fields`。内存恢复旧第二fold立即拒绝。canonicalContent会读取属性，没有排除整个raw对象图中的accessor，因此不能以“plain JSON”文字假设对象入口安全。

当前不是按某一个getter名称特判，也没有早期clone改变原拒绝行为：所有object输入原样走第二fold；仅由JSON.parse创建的独立纯数据图允许复用。正式负控通过fold spy标记阶段，避免硬编码源码行号/第几次getter读取；覆盖persistentGrowth和preparation两处不同属性。对应复现命令：

    npm test -- tests/m8-b8-restore-fold-reuse.test.ts

## 当前未完成/下一检查

- 当前保守版需重新确认string路径计数/收益、全部精确拒绝及正式sniper专项，然后一次最终全量。
- Herald五例分层已在1860754/f268源上完成，两次真实生成/恢复验证及30/30专项记录保持有效；当前生产源hash变化后，其manifest尚未重生成，默认来源验证将发现源指纹差异。须后续明确重生成+独立verify，预期五raw及trajectory字节不变，不把旧来源证明冒充当前源。
- 当前包体尚未实测；旧生产502900/全导出可达503457仅属于原src5f9版本。最终按当前批准B8整批暂停512364/全包552191分别重测。
- 浏览器关闭另在独立观测性提交处理，未声称这次fold改动解释或修复Chrome关闭。

before/after/targeted逐份原始字节均gzip9，manifest保hash；不覆盖CI200、初版缺陷或测试日志。①外部签收保留，②未签收，不进入③/B9、不合PR28。
