# M6 保存合同 v1（F1 已冻结）

状态：F1已冻结，数值引用src/m6/limits.ts与M6_GOAL。范围及验收以 M6_PLAN.md / M6_GOAL.md 为准。

## 包装与身份

`SaveEnvelope = { kind:'hex-autobattler-save', saveFormatVersion:1, replayFormatVersion:1, runId:string, createdAt:string, match:MatchState, battles:BattleRecord[], currentBattle:BattleRecord|null }`。只接受本轮正式包装；内层 schema5 / m5-14.24b-v1 / s13-14.24b-slice-v1 / protocol2 / lcg32-v1 / 50ms / fnv1a32-utf16:d40612fa 不变。runId和时间只在领域外生成。文件不携带有效本地写权限；activationEpoch和revision仅本地持久化。

种子使用完整十进制整数文本，0至4294967295，拒绝空白/部分解析/符号/小数/超界；先trim再用`/^\d+$/`与安全整数范围验证，允许首尾空白与前导0，拒绝符号、指数表示。随机seed通过域外crypto.getRandomValues(new Uint32Array(1))一次生成，显式createMatch(seed)。runId使用crypto.randomUUID；同seed新局必须新身份。

## 捕获与观察

主控MatchSession统一通知命令及advance每个完整step后的合法状态；包含before/after、该次事件、原因。失败和no-op不保存；阶段变化、开战/结束立即排队；战斗每40tick排队。一次frame多tick不得跳过中间40边界。

排队捕获 Match 深副本、当前战斗前缀及游标、不可变已完成战斗key清单与新增记录。不可保留活动可写引用；不可每40tick复制全部完成历史。捕获一个合法tick，不入accumulator/DOM/Phaser/音效/动画。Continue/New前先记录完终局事件及档案。

## IndexedDB与CAS

一个当前槽及最近三个完成局。metadata/current存 `{runId,activationEpoch,revision}`；runs存当前Match、当前前缀、完成战斗keys和必要元数据；battles以[runId,combatId]存不可变完成记录；完成局顺序与三局上限同事务维护。

所有写事务覆盖metadata/runs/battles，在事务内读取并检查预期三元组；初始expected=null仅在槽确实不存在时成功。每次本地激活产生新epoch，导入相同runId亦然，revision单调递增且不信任文件。单协调器串行写入，排队快照固定；乱序回调不能替换新激活的UI或指针。冲突永久停止该写序列并允许本地导出。

activate在导入锁内先排空或围栏旧序列，CAS失败保留旧局；不能无限重试并覆盖第二tab。已完成battle仅新增或校验相同内容，不能静默改写；同runId导入旧文件须在激活事务原子替换该run记录和引用，epoch使旧写失效。不能在IDB事务里await重演/哈希等外部任务导致事务失活。

gameOver归档+排序+第四局淘汰在同一事务。新记录成功提交才对外视为淘汰成功，abort保留原三档；清理无引用battle同事务。替换未完成局有明确UI提示和导出入口。

## 导入、导出、状态

导入从File.size边界开始，顺序：读取/JSON解析→包装边界/版本→restoreMatch→历史冻结上下文完整重演验证→独立候选会话→事务提交→替换活动会话/UI。导入期间锁输入/领域推进，开始和结束均清accumulator；失败恢复原状态且不补算等待时间。未知版本、裸M5、错digest、坏历史、超限拒绝。摘要只校验一致性，不声称防作弊证明。

导出同合法tick的Match+档案游标，不先要求保存成功，不消耗RNG。存储Unavailable/Quota/Abort/Conflict均不破坏正在游玩的对象，仍可导出。

UI至少保存中/最近保存成功/保存失败；成功仅transaction.oncomplete发出。visibility hidden暂停领域、尽力保存；visible重置accumulator和首帧delta，不追赶离线时间。突然关闭恢复最近成功提交tick，未提交写可能丢失，不承诺绝不丢2秒。

## 组件与所有权

A提供seed.ts、格式验证/导出、SaveRepository、SaveCoordinator、SaveControls；主控提供capture、replaceSession、pause锁和观察通知。A不引用BoardScene、不能修改simulation。挂载独立save-root，由D提供DOM壳。

容量与耗时最终常量已依据 docs/evidence/M6_F1_* 填入M6_GOAL和src/m6/limits.ts，唯一使用，不得代理私设另一套阈值。
