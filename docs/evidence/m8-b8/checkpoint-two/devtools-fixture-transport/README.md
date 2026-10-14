# input-dev P2：保持完整值图的原生分组运输修复候选

## 根因及精确复现

CI209/e77原stderr直接报100MiB DevTools管道容量耗尽，再发生page-close；原负载未进入可返回measurements的阶段。重新执行相同五公开路线，脚本/source指纹、所有选中负载、字节数及bounded hash与CI209完全一致。

首次evaluate的普通JSON **68699305 B**，但锁定Playwright1.63.0实际utility编码参数 **107470221 B**。完整CDP消息保守下界（空动态object/session ID，含NUL）**107480700 B**，超过104857600达 **2623100 B**。客户端→driver→CDP复核一致，不能把此原因叫OOM。current真正传参带28战，**20019632 B**；旧manifest incrementalBytes2190029只度量match/currentBattle/battleKeys，不是完整传参。

普通JSON往返虽然deepStrictEqual且无undefined，却会丢19685条重复引用，其中3619跨顶层字段。单字段拆传同样错误。保持alias连通分两组：

- `{complete,fullLoad}`：CDP编码75143636 B；
- `{current,record}`：CDP编码32212896 B。

锁定codec独立解码重建：完整值、原字段顺序、518938唯一对象与19685全部alias边一致；普通完整值JSON SHA256 **091351986d70ca5f08a9aec5881e35d3ddace5946fcff9eb5d2b08681ab20ec4**。

原始五路线/源码/实际锁定codec/CDP编码和图证据包 `payload-diagnosis.tar.gz`，SHA256 **ac266e72cbe24a56a1d01b3700a7c3a459ee23066fba23f8a2d9234b6b20a0ce**。这是诊断复制，不是正式浏览器通过。

## 最终小范围方案

只有scripts及专项测试变化，没有生产/玩法/冻结合同变更。`m6-fixture-transport.cjs`不编码或解码fixture，不新增数据codec：仍由Playwright原生运输两组，随后用两个handle构造原字段顺序的临时staging根。

1. 前置guard要求目前支持的plain对象/稠密数组/primitive，拒绝跨组alias、accessor/隐藏属性/symbol/函数及undefined，遇未来不支持数据明确失败，不静默丢字段。当前真实fixture无undefined。有限数之外的特殊number也由原生协议保留，签名另记录其路径。
2. 只计数锁定1.63.0协议的真实参数大小，保留1MiB命令外壳余量；未来组过大明确报运输错误，不删payload或提高门槛。升级Playwright必须重新审计大小模型。
3. 所有group handle在helper返回前dispose；测量调用的非async小wrapper取出staging、立即delete，直接return原async callback(fixtures)。wrapper不await、不留额外fixture handle，测量期间只有原callback的参数/局部值持有原图。原三个callback正文逐字未改。
4. **正式测量页不在计时前执行完整JSON/signature/Map遍历。** 浏览器完整传输签名验证放在全部原timed阶段（含lifecycle/bounded）结束后的独立verificationPage；同一fixture、同一运输helper再次传入并校验完整值与alias图，之后关闭该页。其失败仍让整个作业失败，不能跳过。
5. Node前置signature不在Chrome堆；报告分别记录运输setup及独立verification耗时、helper hash、两组尺寸和收到的签名。这些不算原性能样本。1次大协议传输变2次较小传输的未计时分配路径有所不同，不能据此声称游戏/恢复性能提升；原计时body、12次fullCapture/其它样本、gates、skip与阈值原样。

## 验证与限制

Node22.23.3：16专项全过（含模拟native handle生命周期/失败清理、容量边界、跨组alias、特殊scalar、隐藏getter、undefined精确拒绝）；typecheck通过。6项AST检查证明三个原callback逐字相等、所有measure/measured/gate/defer原样、原route及payload块原样、非asyncwrapper先删staging且无参数payload，浏览器signature在全部原计时之后。

完整真实fixture通过修复helper的精确大小计数与模拟native运输重建，完整deepEqual/值hash/518938对象/19685alias均相等；最终使用JSON Pointer无歧义路径，aliasSHA **3b85769ff2b89f4a36deddec5ef29cea4defd726c698bfc47908eb32a9fe7710**。模拟不是Chromium实机。

第一版未提交候选曾把浏览器重signature放在测量前并用fixtureHandle固定根；技术预检指出JSON预热/GC与保活风险，已撤回。其源码/日志在validation/superseded，不能作为最终候选证据。最终guard明确拒绝undefined避免原签名遗漏其相对键序，且检查非枚举属性；没有放宽现有恢复校验。

本机Chromium受socket权限限制，没有再次启动或伪造通过。真实传输、原性能门禁、清理和完整CI仍待新实际SHA运行；input-dev P2须依据该结果关闭。TG另有本轮有限排查的未解决范围阻塞，本修复不代替TG修复或②签收。

### 原档按字节分片（非重新压缩）

为可靠API备份，原20,098,699B压缩档按2MiB切成10份 `payload-diagnosis.tar.gz.part-00` … `part-09`。整档原SHA256仍为上述ac266e72…；各片字节数/SHA256在payload-parts.json，作者已重新拼接逐字验证相等。重组：

```sh
cat payload-diagnosis.tar.gz.part-* > /tmp/b8-payload-diagnosis.tar.gz
sha256sum /tmp/b8-payload-diagnosis.tar.gz
# 应为 ac266e72cbe24a56a1d01b3700a7c3a459ee23066fba23f8a2d9234b6b20a0ce
```

原档保留原压缩字节，没有重压或裁剪；新增validation日志另以gzip9封存。该分片仅影响证据运输，不是游戏fixture传输实现。

内部最终小范围只读预检未发现当前locked fixture的实证阻断；它没有独立重跑Chromium，不是外部②签收。后置verificationPage验证的是同一来源fixture、同一运输函数的独立传输实例，**不是从正式测量实例读回**；测量实例的输入等价依据是固定确定性同payload、原生协议保持图及完整离线同构证明。真实CI仍须同时完成原门禁与这项后置完整图验证。异常在staging已赋值后发生时，外层browser.close销毁page并使run失败，不用残留staging制造通过。
