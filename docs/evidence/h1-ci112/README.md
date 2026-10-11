# 普通CI112首轮失败及一次重跑

[CI112 run37874466844](https://github.com/catfish-xn/cat/actions/runs/37874466844)，固定a3ea85c5facb2ceaf556244e26391ca20b5ff0f5。

首轮browser-preview-cannon-sample1在原1MiB断言失败：14,489,140→16,151,552 B，delta1,662,412 B。[首轮artifact11591608337](https://github.com/catfish-xn/cat/actions/runs/37874466844/artifacts/11591608337)仍保留；日志已读取，其他作业成功，compare因依赖失败跳过。

本次相对上一提交只增加诊断文档/证据及不被该作业调用的离线归档helper；src、tests、原probe、原CI、依赖清单相对97f38a0没有差异。原runner与source始末指纹吻合；归类为当前H1同类重复超限，不修改任何门禁。

按用户规则，在首轮结束后仅调用一次failed-jobs重跑端点。GitHub实际重跑了下游compare所依赖的整套作业，第二次12个必需作业全部成功；没有第二次重试。preview/cannon第二次14,739,160→14,519,800 B，delta−219,360 B。[重跑artifact11592753632](https://github.com/catfish-xn/cat/actions/runs/37874466844/artifacts/11592753632)。

两份archive的SHA/CRC、相同原runner/source指纹及实际Chromium153均核验；生命周期原字节与身份/哈希摘要保存在本目录。普通CI观察不并入预登记正常12样本，不能用一次重跑通过证明无泄漏或统计误报率。首轮失败不被覆盖。
