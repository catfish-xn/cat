# 固定 125868 本机完整验证（2026-10-10）

远端 `1258682c02020edc7b6b665e448678e0c889c2d4` 与本地 `bfaff72030d3a25ecc862d3cbb923f4057788eeb` 整树相等：`495d02bb42de698b5c18d4988bd8e7df615a2322`，生产 src 树 `16568c527580d74caca79e988bb5e8a1d43a290b`。本目录是随后追加的证据，不冒充受测提交内已有材料；最终含证据 HEAD 仍须自己的 CI。

在仓库根目录按顺序原样执行（没有 timeout/worker/门禁参数修改）：

```sh
export PATH=/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin:$PATH
npm test
npm run typecheck
npm run build
node docs/evidence/m8-b8/checkpoint-two/measure.mjs
node docs/evidence/m8-b8/checkpoint-two/analyze-exports.mjs
```

Node 22.23.3、npm 11.9.0。132 文件全部通过，1852 passed / 10 原有 skipped，505.67s；typecheck/build/双口径测量全部 exit 0。测试前后 HEAD、整树和 src 树完全相等。原始元数据文本中的 npm 警告 PID 不同，未删除或覆盖；`source-equality.json` 单独核对三项 Git 标识。

每份 log 按 gzip 9、mtime 0 原字节封存，manifest 包含压缩与解压后 SHA256。`status-before/after` 均只有未跟踪依赖符号链接 node_modules。基线目录来自 Git archive，不是独立 Git 仓库；`baseline-source-check.json` 核对固定 `2acb9acfe90ad7936083fa2c7018dd482b6b222f` 的 163 项 build 输入，无差异。

| 口径 | 每 JS gzip 9 合计 | 相对 488964 | 到 B8 512364 余量 |
| --- | ---: | ---: | ---: |
| 生产 | 502898 | 13934 | 9466 |
| 五模块全导出可达 | 503479 | 14515 | 8885 |

可达探针比生产多 581 B。Rollup 原始元数据表明只有 `loot-choice.validateLootPendingChoice` 函数本体在生产被摇树移除，renderedLength 718→916，即 198 **未压缩**字节；581 B 还包含探针 namespace、Object.assign、保留名称与 gzip 布局，不可把 198 换算成精确 gzip 成本。生产中 pendingChoice 由 `validateB8Loot` 重建 `makeLootPendingChoice` 并严格相等检查，未因导出不可达缺失验证。③首次查询可达成本必须重新实测，581 不是纯新增功能债。

本机没有运行 Chromium。原 CI200 input-dev M6 页面关闭仍待带最小观测记录的新 CI；本次本机全绿不证明该问题已解决，也不代替最终同 SHA CI 或用户转交的外部 Codex 签收。
