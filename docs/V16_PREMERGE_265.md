# #265 v16 合并前修复

工作基线：`codex/epic-loot-reforger @ b13373c67bf7056e1e56e99e4d7cd5f875df7712`。不联网、不安装依赖、不写 Git 元数据；未改 `src/server/`、`src/rendering/`。表现层只改 `ability-text.ts` 的数值查询映射。

## 1. Herald 身份链

原输入审计仍固定 `e6c0921f…`，但 b13373c6 的 manifest 为 `789593e8…`。逐字段比较 b13373c6 与父提交：只改变 `sourceSha256/sources`，涉及 projection、d14-runtime、private-seat-view 三个源码哈希；五份 raw 和 trajectory 字节全部相同。因此原失败属于合法源码清单重录后的审计遗漏。

本次新增技能说明查询后，按 v16 epoch 重新执行 release → Herald `--write` → inputs → live-reveal，manifest 现为 `4a25dc59…`，输入审计由录制器自动绑定最新字节。五份 raw、trajectory、golden、两个检查点解压后的内容仍与 b13373c6 相同；两个 gzip 仅第9字节的操作系统标识变化。没有手改夹具或摘要。

`node scripts/audit-herald-refresh.cjs` 重现以上比较，结果见 [Herald 审计](evidence/v16/premerge-265-herald-audit.json)。`node scripts/v16-fixture-audit.cjs --baseline-commit=46454b77348c86b70a4fec57869f95c22ecf9682` 验证 G2-3/G2-4b 的86份历史文件、v15的23份历史文件及历史身份断言不变。inputs/live-reveal 的 `--check` 均通过。

## 2. 2D 生产包

使用同一 Node 22.17.0、同一共享依赖，直接从 Git 归档重建 `15313a7`；不建立 worktree 或写 `.git`。测量严格沿用 `scripts/m7-budget.cjs`：全部 `dist/assets/*.js` 逐文件 gzip level9 后求和，拆出的 Phaser 也计入。

| 构建 | gzip 字节 | 相对15313a7 |
| --- | ---: | ---: |
| 15313a7 | 424,763 | 1.000000 |
| b13373c6 修复前 | 641,071 | 1.509244 |
| 本次修复后 | 629,621 | **1.482288** |
| 修复后再加1,400 B | 631,021 | 1.485584 |

节省11,450 B；距1.49目标尚余约3,276 B，1.50门槛未改。前后均实际运行预算脚本；修复前按预期返回失败，修复后通过。修复后首次可交互中位数802→795 ms（3个正式样本），比值0.991272；这是辅助观测，未以此代替确定性 JS 预算。

实现为 Phaser 独立 chunk，以及 `scripts/production-identities.ts` 的生产构建投影：通过原始领域模块计算 CONTENT_DIGEST/LOOT_REPLAY_DIGEST，只把两个身份根的静态摘要常量化；动态状态/账本散列仍执行原函数。四张原始来源目录仅向浏览器保留已有消费者读取的列，归档说明、来源元数据不随包发送。仓库完整源表、摘要输入和原有冻结调用均保留；没有删除物品、技能、池或校验逻辑。

`node scripts/verify-production-identities.cjs` 在完整来源与生产投影两套 SSR 环境比较9项身份/编译目录（包括全体单位、技能、物品、羁绊、强化、异常、重铸池），并逐步比较 seed42/7216/6240 的首战状态与事件，全部相同。浏览器预算脚本也实际加载拆包产物并等待可交互。未来来源表消费者若需要额外列，应同步构建白名单并运行此等价性检查。

两个摘要保持 `CONTENT_DIGEST=fnv1a32-utf16:f8a31ce9`、`LOOT_REPLAY_DIGEST=fnv1a32-utf16:cee1d7d7`。

## 3. MatchSession 的旧奖励期望

英雄候选池未变。按已批准的 v16 法球合同，每颗普通法球在基础奖励后额外消耗一次复制器抽签，推进同一奖励 RNG，后续英雄/组件因而改变。新 BigInt 独立拒绝采样向量不用生产 RNG，实现和期望分别核对：

| seed | 1-2英雄/bonus/1-3英雄/bonus/组件/bonus 的索引 | 正确奖励 |
| --- | --- | --- |
| 7216 | 3/77/1/91/6/41 | Maddie → Irelia，组件为拳套 |
| 6240 | 3/37/3/95/6/89 | 1-3为Maddie |

更新两个 roster/收据期望，以及被先前 roster 失败挡住的 cloak→gloves 期望。保留单位序号、来源、原始死亡证据、幂等、资源和不可变性断言。18项通过，无规则实现修改。

## 4. 双刀流超时

原20秒在并行竞争下超时，逐文件运行全部断言通过，实测12.66–13.77秒。原v15归档中的同一测试在相同工具链独立运行11.10秒。分阶段对比及负载计数见 [机器验证记录](evidence/v16/premerge-265-verification.json)：耗时主要在真实路线生成及整段命令重放；严格恢复对约数十毫秒，未出现恢复卡死。v16的奖励/RNG与异常池变化使路线及战斗负载不同，不能将这两条不同轨迹的时间差全归因于单个新增函数。

按用户04:22授权，将此用例临时上限设为30秒，约为实测两倍并向上取整；注释明确临时和授权来源。原先三份失败文件额外并行复跑162项全部通过，双刀流15.15秒。没有缩减命令、断言、恢复次数或全局门槛。若未来在相同机器逐文件运行持续接近30秒，应另行调查，不能自动继续放宽。

## 5. #270 数据需求

`ultimateHeroAbilityDisplayValues(definitionId, stats?)` 已从 `src/simulation/ability-display.ts` 导出纯函数。复用专用四星基础与实际 rank4 技能表、14.24b辛吉德60%减伤覆盖；返回模板 token 和派生值，既有AD/AP边界不变。`abilityText(id,4,stats)` 仅映射到该查询，1–3星仍走原路径。14个一费英雄均无残留 token；Lux1260伤害/300护盾，150AP时1890/450。新增15项及原73项说明回归通过。

原版侦察可见性仍为 **Unknown**：本地14.24元数据缺少两个执行引用，也没有客户端显示/网络复制字段。实际rank4技能和升级说明不足以证明对手是否可见。遵守“有依据才加”，保持公共物理3星，没有越界修改服务器；撤掉 UI_REQUESTS 中把它称为“有意设计”的表述，记录保守回退与证据缺口。复核：`node scripts/audit-d14-scouting.cjs`；[证据](evidence/v16/scouting-visibility-audit.json)。需要原版客户端执行/同步资料或可核验录像才能给出确定结论；本次没有伪称已证明隐藏。

## 验证与提交建议

`npm.cmd run build -- --configLoader runner`（含项目 `tsc --noEmit`）通过；构建插件/Vite配置另外用严格 `tsc --noEmit` 检查通过。runner 参数用于绕过本机共享联接下默认 esbuild 配置加载的目录访问错误，不改变构建目标或编译器。Playwright使用本机已安装Chrome，没有下载。

逐文件执行 opening-random-identity、match-session、s13-p1-dual-wielding、全部d14-*、epic-loot-reforger、g2-2-ability-display及presentation目录四文件：**13文件/399项全部通过**。生产投影等价检查、历史字节检查和 v16 输入/揭示复核均通过。没有声称跑过完整仓库或联机房间验收。

建议提交：`fix(v16): repair epoch audit, trim 2D bundle and expose four-star tooltips`。仅工作区修改，尚未提交。机器数据见 [验证记录](evidence/v16/premerge-265-verification.json)。
