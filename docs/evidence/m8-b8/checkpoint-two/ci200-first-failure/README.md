# CI200：固定 c854 的首轮终态，保留失败

- Run：<https://github.com/catfish-xn/cat/actions/runs/38031091668>，attempt 1，2026-10-10 07:08:57Z 终态 failure；未重跑掩盖。
- 固定代码 `c8543e192589cdc52b2a2119a45d5bfd613d8bf7`；本地等价 d201，src tree `5f9b62228b236074efd78b50a571cc26d23858e5`。本证据不覆盖后续修复提交。
- 作业为 10 success / 2 failure / 3 skipped。六个 browser 真实路线、input-preview、M7、U3、retention 成功；test 与 input-dev 失败；compare 因前置失败未执行，另两项 optional skipped。12 个执行作业 checkout 均已核同 SHA。

## Test

<https://github.com/catfish-xn/cat/actions/runs/38031091668/job/114152012079>

131 文件：128 passed / 3 failed；1857 测试：1840 passed / 7 failed / 10 原有 skipped；836.93s。

六项原 5000ms 超时仍在：TG 43 定义公开路径覆盖一项、Herald 三个 aura 和两个 immunity/cleanup 用例。新增 sniper replay 超过原 180000ms：实际完整执行 182 commands / 11930 ticks 并输出 passed:true，但耗时183.481s，Vitest已判超时，因此仍是失败，不能以完整跑完替代时限。

后续小修与获批 Herald 五例分层另有提交与证据，不覆盖或删除这次失败。TG 例外不套用 Herald raw 输入方案。

## Input-dev

<https://github.com/catfish-xn/cat/actions/runs/38031091668/job/114152012025>

native 31 cases 与真实 touch-cannon 路线已通过；后续 M6 performance 在首次 page.evaluate 抛 `Target page, context or browser has been closed`，没有获得 measurements，整作业失败。

生成五条 route 耗时85520.7ms；失败记录102850ms包括该生成阶段，不能称浏览器单独运行了102秒。独立只读诊断排除了脚本finally先关页及32分钟job超时，尚无Chrome stderr/crash/exit或进程内存证据足以确认关闭根因。`errors=[]`不证明没有浏览器崩溃；记录的2397937664B峰值是Node RSS，不是Chrome进程树内存。

**input-preview成功不是同负载M6 performance通过**：工作流仅MODE=dev执行该脚本，preview只含原首轮输入性能观察。CI170通过记录仅作为不同CPU/输入的历史有限对照，不据此称当前dev是偶发。

实际fullLoadCoverage已有15装备，但旧B8 full-load断言仍deferred；该事实不等于断言执行通过。lifecycle与boundedImport阶段尚未执行，不记成功或自动解除延期。

## 原字节及后续

本目录保留最终run/jobs/artifact元数据、完整性清单、摘要、两个失败job原始日志及performance失败JSON，均gzip9并记录原始/压缩SHA。原12 artifact总251988973B，完整性清单已核GitHub SHA256一致；未为了仓库大小重压或重写原artifact，原包保存在证据工作区。

后续仅按明确根因修复及获批观测性取证；不改变超时、性能负载/样本/计时边界/门槛/skip，不做无变化全套重跑。最终②仍须实际最终SHA全绿CI及用户转交外部Codex审查。
