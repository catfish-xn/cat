# PR168：精确已完成历史复用（进行中）

起点 c3587d73c0a42367b805001a92cde1dd8fd1a8ba，本次 fetch/ls-remote 远端仍8e81bc5，因此依用户授权从本地继续，未合其他分支。

第一阶段生产代码 ef1ee43f5e88b6e0ae6e7d87a9d87f18eb8b881c：单独src/simulation/preparation-ledger.ts与新安全测试。

## 设计

- 只在最后一次真实成功 nextRound 返回处保存自产可信状态；不是存档的中间快照，也不是任意前缀复用。
- 实际 rules/policy/content身份、seed和截止该nextRound的完整命令（含该命令参数）精确定位；还必须逐字核对候选历史events/roundResults全文，长度来自缓存中已独立生成的状态，不取候选自报长度。无round事件也完整纳入。
- 当前轮全部准备命令、开战及当前tick尾段每次真实执行，最终当前gold、XP、shop、四RNG、事件seq与其他原字段完整比较。只有整个候选通过后才准许入库。
- 新history缓存8条/8MiB，原standalone8MiB和collection64MiB保留，累计80MiB canonical UTF16计账上限；仍是LRU与条目/字节双上限，不代表实际heap上限。collection不跨namespace借用此缓存。
- 旧任意prefix缓存限制保持；本次允许的是精确完整已完成历史，当前尾段始终复验。

## 诊断与中间结果

原11项超时完整证据在 ../multiplayer-sync/。2-7分段诊断29次账本共9253ms，测试约9.7s；是实际重演，不是哈希成本。第一次诊断过滤字符串未选中任何用例，随后修正过滤名；两份日志均保留，未把未执行算通过。

opening初版中间工作树（尚未最终nextRound边界）整B7：19过/6真实超时/5旧档缺账本。单例耗时详见b7-history-file.json；2-7 2583ms、3-7 4848ms已过，其余实际超时保留。不将这个中间工作树结果宣称为最终代码验收。

进一步6-7分段：35次账本累计18.56s，其中准备期首次8.32s、开战tick0再次8.58s；尾段每次约0.15–0.20s。最终nextRound边界针对两次冷建重复，当前准备命令也逐次重演。

最终边界一次cold6-7 CPUprofile诊断9075.7ms（插桩，非验收）：structuredClone约1.8s，主要每tick单位动态状态复制；advanceS13Tick自身和匿名回调约2.56s、GC约0.57s，记账command clone仅约64ms。临时诊断源码和profile存本文目录，没有放入默认测试；诊断超过原5秒也按失败记录，未修改门槛。

新回归最初误选emptyBoard准备路线，历史combat step为0，断言失败；改用真实三英雄完整战斗再nextRound，保留首次日志。新测试验证非空历史、当前尾段步数、历史无round事件/roundResults一字节改变全重打并拒、重复gold+1明确拒因、RNG/命令篡改、getter与返回对象污染隔离、续战一致。

## 执行次数断言适配

verified-restore-cache.test.ts 中原当前gold+1负例要求每次执行全部历史steps；新已批准完整历史缓存使历史复用，改断言为0历史steps。原精确拒因 preparation-ledger-gold、重复调用拒绝、失败结果不被接受全部保留。新测试另明确历史字节篡改必须重打historySteps+2并拒，合法/非法当前尾段仍按2或3步实际执行。这是执行次数依据变化，没有减少恢复要求。

目前最终nextRound设计相关12文件188/188已过，B7最终整文件验证尚在进行。不得将此进度写为所有超时已解决。

## 已批准暂缓

护盾5个正控等PR161神器锻造器真实可达路径，不改任意grant成白名单，不跳测试。Herald5旧raw缺账本按明确旧档政策保留，统一版本升级时再迁移。#157未入实际基线，冠冕金组合不在本轮执行。
