# B3 0411ad6 同步：单一 golden 冲突的严格解决

用户明确允许0411ad6同步进B6，按两项已批准语义解决golden，并把冲突处理一起重新送独立审计。未把B6合回baseline。

- 第一父：`9e0b35465bab14b5adc8d1446a1bb2d045018286`。
- 第二父：`0411ad65c1933e87df840042f38cfe1ce834d127`，fetch现场确认目标未漂移。
- 共同基线：`adf24b4ef6f5ec65b3abd59adc050ad2b6b82880`。
- 唯一文本冲突：`tests/fixtures/m5/full-match-golden.json`。原stage1/2/3 blob ID见merge-metadata.json，原combined diff完整保留为original-golden-conflict.diff.gz。

## 原双方意图与逐段处理

| 字段/原combined diff行段 | B6第一父 | B3第二父 | 解决方式 |
| --- | --- | --- | --- |
| 四条`routes.*.versions.contentDigest`（hunk旧B6行7/877/1740/2633附近） | 已批准新38轮目录/33战及开场语义，digest eb9d2788 | 通用开场damage→存活目标stun顺序加入规则digest，但仍基于旧30战 | 两套生产语义均保留；实际合并代码生成统一digest c1704f5d，不手填旧任一digest。 |
| 四条`routes.*.rounds`（旧B6行707/1570/2463/3350附近） | 每路线33战的新轮次身份、commands、事件/状态轨迹 | 每路线旧30战，B3在该旧目录里只改digest派生stateHash | 保留B6的33战结构及全部命令/事件；实际跑合并后四路线132战，通过下面的严格等价检查后只更新stateHash。不能整文件取theirs退回35轮，也不能直接取ours忽略B3 digest。 |
| 末尾`note`及B6观察字段（最后hunk） | 明确B7/B8/B9待办和真实B6路线观察 | 描述旧120战的digest-only证明 | B6原说明/观察原样保留，另追加本次132战严格证明和两个父SHA；不把B3旧120战结论移植成新132战证据。 |

无其他文本冲突。B3通用执行器4个生产文件、新独立测试/输入夹具、原B3守卫更新器及文档均字节保留第二父；B6日程/开场/恢复源码不改。冻结合同、G12、U3、CI和门槛没有新修改。

## 可复现守卫，而非重新接受行为差异

1. `full-match-golden.pre-b6-b3-sync.json`是9e原件，SHA256固定`1adf09af7b7508277599703677a9d3fdc7d87b46799384671fbbcd7694204395`。
2. `scripts/update-m8-b6-b3-golden.cjs`先核对该SHA，再调用真实合并生产代码生成四路线；独立oracle继续核对每步经济/RNG/结算。
3. 强制638条commands完全相同、132场eventsHash完全相同、把每场完整状态唯一替换回旧contentDigest后hash全部等于9e；其他版本字段和B6获取/胜负观察也必须相同。
4. 四路线全部通过后才写golden，唯一数据变化为四个contentDigest与132个stateHash，另追加透明说明。任一行为变化会停止且不覆盖新golden。原宽松B6轨迹记录器没有用于这次冲突解决。

实际结果见guarded-golden.json/.log.gz：四路线158/160/157/163命令、各33战全部通过，统一新digest `fnv1a32-utf16:c1704f5d`。无需改commands或events期望。

10文件135项定向通过，包括B3新增14项、B6目录/开场/恢复、冻结G12及H1/B6比较边界；build包含typecheck通过。日志targeted.log.gz/build.log.gz。这是最终merge提交前同一合并代码的验证，完整CI/体积关联/独立审计须绑定保存后的固定SHA，不预签收。最终tree与两parents由root在GitHub提交/PR评论核准，避免把自身tree写回文件造成身份循环。
