# Fixed-ref portability repair, after the original migration was sealed

这是原 golden 已迁移并封存后的工具可复核性修正，不是第二次 golden 更新。原记录保存在父目录，不改写其 audit、manifest、raw captures、diff、日志或旧 golden 档案。

## 唯一行为变化

`selectSourceRef` 只考虑两个冻结的完整提交 ID：

1. `50786a196cdff0762867e2918813a090df4fcac6`，已发布的对应源，默认优先。
2. `2814d0146a3a109d8cef920034ba67d0cc571bf0`，原捕获环境中的本地提交，只在它确实存在且前项不存在时后备。

任何已存在的候选必须同时匹配：

- whole tree：`4f982ed61cd6247c0d6a0033a156799e6c6d026f`
- src tree：`5f9b62228b236074efd78b50a571cc26d23858e5`
- 原 183 文件 new input fingerprint：`4506f5918cc3c9b8b5065f4332316a1c07bfb23ccd4d8fbbc5e70141ed90f44d`

不接受任意同 src 的其它 commit，不尝试 HEAD，不增加用户配置，不扩大 schema/版本/digest 的接受范围。遇到已存在但 tree 不符的 ref 立即拒绝，不再降级尝试。两个对象都没有则明确失败。工具不会 fetch、reset、rebase 或生成/伪造 commit 对象。

新 clone 若为浅克隆且缺少历史 published 对象，可明确运行 `git fetch origin 50786a196cdff0762867e2918813a090df4fcac6` 取回这个真实对象，再用 `git rev-parse 50786a196cdff0762867e2918813a090df4fcac6^{tree}` 和 `git rev-parse 50786a196cdff0762867e2918813a090df4fcac6:src` 核对上面的固定值。此步骤不改变工作树，也不把无法在远端取得的本地ID伪装成远端对象。

原 `NEW_COMMIT` 字段继续表示原始捕获来源；新 audit 增加实际选定 sourceReference 和两个明确允许的 source refs，不能把原捕获历史改写成后来在远端运行过。

这一修复仅消除新源引用必须是未发布本地2814的障碍，不是通用自动迁移器。正常clone仍需 Node22.23.3、原 installed-lock 与依赖版本、原183输入hash、未迁移的精确旧golden，以及旧capture所需的 `4554f5afee219416be410ff7edbd16ffbeb7daf5` / `ff60a7989ad76052c9720fe58546cc70842b316c` 对象。任何前置缺失仍会拒绝；本次不为其它缺失历史对象新增猜测映射。已迁移工作树不再次apply。父目录README中的“若后续修复”属于首次封存时的历史说明；这里记录其后已经完成的窄范围portable修正。

## 两代字节和审核记录

- 原 updater：`update-m8-b8-golden.original.cjs`，SHA256 `ca53ebd5f6c9f0f23478aca8db5ecd6659fbfe6b7a8239bd9e4a7ff8b371dcc9`。这是逐字节取证档案，保留原相对 import，不能从本目录直接执行。
- 新 updater：仓库 `scripts/update-m8-b8-golden.cjs`，SHA256 `8b57da72d26c33115b1b29eaaea5209770dd72a67c151d537fad7c29b02f3e34`。
- 原 guard：`golden-guard.original.mjs`，SHA256 `57d55f7711274adcb71e26292171f76c26136197fc68c6f5b0606683defe7daa`。
- 新 guard：`tests/m8-b8-golden-guard.test.mjs`，SHA256 `e6210b791dc1cfc1ff32311a1ef15fbcb7a90e66ad2fd443d7e3b34cbf860c55`。
- 原 audit：父目录 `audit.json`，SHA256仍为 `f574c9ed982abd75668134921431efbe77c4d63c46bb1f45e583e709e32fe863`。
- 新工具审计：`portable-audit.json`，先在独立 `/tmp/b8-golden-portable-review` 生成，再复制进本目录；SHA256 `67ad76e0a36d3d9ee38dc544d4b0d524e3807c2d0272029c0ca9e3200c177096`。

新工具审计明确关联原 audit 与两代脚本/guard SHA，不声称它们是同一字节。原父目录 `file-manifest.json` 是首次封存的32文件清单，保持原字节；本次新增/修改文件另列本目录清单。

## 复核结果和真实边界

- 原样执行 `npm test -- tests/m8-b8-golden-guard.test.mjs`，24/24 passed，没有 worker 或 timeout 参数。原19个反例全部保留，新增5条 fixed-ref 优先、精确后备、whole tree 不同、src tree 不同和两个对象都缺失的反例。
- 父目录旧19项运行带单 worker，是保留的诊断结果，不是原样门禁；原日志保持不变。以上新24项及之后最终全量才使用原样运行方式，不能混淆。
- `npm run typecheck` passed。
- 8份原始 capture 的所有 action/round 完整 hash、旧四条 frozen baseline、新四条 frozen candidate、独立 resource/provenance/XP/HP/合成/装备/部署、所有 old/new command policy witness 和四个精确已审 diff 均只读重验通过。没有再次生成 simulation 路线，也没有把只读结果冒充新实战。
- candidate 的字节 SHA仍是 `8d129f70c093a63b339543f65814232f3cfb6daa13d95168aac3b06bdc39ac28`；原 archive 仍是 `007b6b4136d6959b227cbd9567948f83dca75db4ad788fd43d03c4e3cf069cc5`。
- 本地当前没有507对象，实测 resolver 选择存在的2814，且 whole/src tree 均吻合。published-ref 优先分支由纯选择单测覆盖；不谎称在本地实际读取了不存在的远端对象。日志中的 object-missing 提示对应此实际后备路径。
- 原 `--capture/--audit/--apply` 的 live old-golden guard 未放宽。只读调用 `--audit` 检查到已经迁移的8d129时仍故意拒绝，见 `already-migrated-audit-refusal.log`。这不是未处理的任务失败；没有调用 `--apply`，也没有二次覆盖 golden。

这里是内部工具技术复核，不代替最终固定提交的原样全量、浏览器/性能/预算验收或外部正式签收。
