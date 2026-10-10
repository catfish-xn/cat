# 作者侧补证：4d9 对象与公开 eecca 完整树

回应独立诊断6095230143：审查者拿不到作者本地4d9，先前“完整树相等”确为作者声明，不能说已获独立认证。本目录将该声明改为可自行核验的材料；仍是作者侧核对，不证明历史时点未提交工作区。

- 本地真实commit原对象 `local-commit.raw`：按Git的 `commit <length>\0` 前缀计算SHA1，得到 **4d9e5e00269c0ae6d916b58ac92373de2c00b513**。没有生成假commit或修改历史。
- `local-complete-tree.json.gz`：该commit全部 **1284项，含1205文件blob**，逐路径mode/type/blob SHA1/字节数/SHA256，包含完整docs/test/scripts/src而非仅169生产文件。
- 同次通过GitHub只读API取公开 **eecca768f8ee3e88a433e992ef8458e3ce70459e** 的git commit及递归tree（truncated=false），原返回保存为remote-commit.json、remote-tree.json.gz。逐路径mode/type/SHA完全相等，差异为空；共同整树 **a0d09f8705588aa96e9fb9741504fbb33075c41e**、src树 **16568c527580d74caca79e988bb5e8a1d43a290b**。两commit的parent/author/message等元数据不同，所以commit SHA不同。
- `comparison.json`是本机作者实际核对结果。独立审查已经核对的169份profile输入hash与固定eecca相等是另一项证据；本清单不能反向证明历史dirty状态，原profile开始/结束日志保持原样。

正常含公开eecca对象的clone执行 `python3 docs/evidence/m8-b8/checkpoint-two/local-4d9-tree-binding/verify.py .`，会核原commit SHA、API树、当前clone完整eecca树及1205份文件SHA256；不需要本地4d9对象，不创建ref，不运行profile、不缓存恢复结果。作者本机缺远端eecca commit对象，因此本轮实际已执行的是完整本地对象与API清单比对，未把上述“正常clone独立命令”写成已由第三方执行。审查者可用此命令自行复核，或继续仅以公开固定SHA的实测为依据。
