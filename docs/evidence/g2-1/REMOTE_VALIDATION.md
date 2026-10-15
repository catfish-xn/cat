# G2-1 另一台机器验收命令

本机不再启动测试。以下命令只在接手的 8c16g Linux 机器执行，按顺序串行运行；全套期间不编辑代码、不运行其他任务。PR #94 保持草稿，收到结果后再补通过数和转正。不得增预算、skip 或继续优化测试代码。

## 环境与安装

建议 Node **24.21.0**（本机实际版本），npm **11.19.0**；项目最低 Node 22.12+，为保持验收一致使用建议版本。另需 Git、Python 3、Bash。若已安装 nvm，可执行 `nvm install 24.21.0 && nvm use 24.21.0`；否则用现有 Node 安装方式安装相同版本。

新目录检出（把下面 EXPECTED_SHA 替换为交接消息中的完整 head SHA）：

```bash
git clone --branch codex/g2-1-content https://github.com/catfish-xn/cat.git g2-1-validation
cd g2-1-validation
EXPECTED_SHA='<交接消息中的完整 head SHA>'
git checkout --detach "$EXPECTED_SHA"
test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"
node --version
npm --version
python3 --version
npm ci
npx playwright install --with-deps chromium
```

c7 **需要 Chromium 浏览器及系统依赖**，以 headless 模式运行，不需要桌面、DISPLAY 或手动打开浏览器。`--with-deps` 安装系统依赖可能需要 sudo/root；浏览器安装与测试应使用同一用户。c7 harness 的默认浏览器路径是旧机器固定路径，因此执行时必须按下文设置 CHROMIUM。Vitest 全套、typecheck 和 server-entry 不需要浏览器。

以下各段在同一个 Bash 会话执行。输出写入仓库外目录：

```bash
set -euo pipefail
G2_OUT="$(mktemp -d /tmp/g2-1-validation.XXXXXX)"
export G2_OUT
printf '%s
' "$G2_OUT"
git rev-parse HEAD > "$G2_OUT/head.txt"
node --version > "$G2_OUT/node.txt"
npm --version > "$G2_OUT/npm.txt"
git status --porcelain > "$G2_OUT/status-before.txt"
```

## 1. 逐文件验证本轮改动

以下完整单跑本轮修改的 32 个测试文件，并补跑受夹具影响的 M5 route、C19。每次仅一个文件、一个 worker；每个文件留独立日志和 JSON，任何失败立即停止，先把完整日志贴回。此前本机通过的 6 个文件可在这台机器复核，不引用已作废的旧全套结果。

```bash
{
  git diff --name-only 3a2a1e96fb86e20b995234a6d0281e5c1a867829 HEAD -- tests | sed -n '/\.test\.ts$/p'
  printf '%s
' tests/m5-route.test.ts tests/c19-missed-pulse.test.ts
} | sort -u > "$G2_OUT/individual-files.txt"
mkdir -p "$G2_OUT/individual"
while IFS= read -r file; do
  name="${file//\//_}"
  npm test -- "$file" --maxWorkers=1 --reporter=default --reporter=json     --outputFile="$G2_OUT/individual/$name.json" 2>&1 | tee "$G2_OUT/individual/$name.log"
done < "$G2_OUT/individual-files.txt"
```

## 2. 类型、Node 入口及内容证据

```bash
npm run typecheck 2>&1 | tee "$G2_OUT/typecheck.log"
npm run test:server-entry 2>&1 | tee "$G2_OUT/server-entry.log"
python3 scripts/import-m8-source.py --g2-1 --check 2>&1 | tee "$G2_OUT/source-check.log"
python3 scripts/generate-g2-content.py --check 2>&1 | tee "$G2_OUT/content-check.log"
node scripts/generate-g2-audit.cjs --check 2>&1 | tee "$G2_OUT/audit-check.log"
node scripts/record-g2-1-release.cjs --check 2>&1 | tee "$G2_OUT/release-check.log"
```

## 3. 一次干净的串行全套

确认没有其他测试/构建任务，保持代码不变。不要并行跑 c7 或其他检查。

```bash
npm test -- --maxWorkers=1 --reporter=default --reporter=json   --outputFile="$G2_OUT/full.json" 2>&1 | tee "$G2_OUT/full.log"
```

若失败，保存完整输出；只有 `b8-resumable-battle` 或 `m5-replay` 的超时允许下列对应单文件证明，且仅执行实际超时的文件，不改代码、不改预算。其他失败贴回处理，不能视为通过。`set -e` 可能退出脚本；重新进入 Bash 时先恢复日志目录 `G2_OUT` 并设置 `set -euo pipefail`。

```bash
# 仅 b8 超时才执行：
npm test -- tests/b8-resumable-battle.test.ts --maxWorkers=1 --reporter=default --reporter=json   --outputFile="$G2_OUT/b8-proof.json" 2>&1 | tee "$G2_OUT/b8-proof.log"
# 仅 m5-replay 超时才执行：
npm test -- tests/m5-replay.test.ts --maxWorkers=1 --reporter=default --reporter=json   --outputFile="$G2_OUT/m5-replay-proof.json" 2>&1 | tee "$G2_OUT/m5-replay-proof.log"
```

## 4. c7 真服务器浏览器验收

全套结束后再执行。脚本自动启动/关闭游戏服务器和 Vite；默认端口 8789、5197，冲突时各自尝试后续端口。无需另起 `npm run dev`。检查包含机器人买到并部署新英雄、PvE、交换、合成及候选/对手一致性。

```bash
npm run build:game 2>&1 | tee "$G2_OUT/build-game.log"
CHROMIUM="$(node --input-type=module -e 'import { chromium } from "playwright"; process.stdout.write(chromium.executablePath())')"   node tests/server/e2e/c7-playtest.mjs 2>&1 | tee "$G2_OUT/c7.log"
cp -a artifacts/c7 "$G2_OUT/c7-artifacts"
git rev-parse HEAD > "$G2_OUT/head-after.txt"
git status --porcelain > "$G2_OUT/status-after.txt"
node --input-type=module -e '
import fs from "node:fs";
const r = JSON.parse(fs.readFileSync(process.env.G2_OUT + "/full.json", "utf8"));
console.log(JSON.stringify({total:r.numTotalTests,passed:r.numPassedTests,failed:r.numFailedTests,pending:r.numPendingTests,todo:r.numTodoTests},null,2));
' | tee "$G2_OUT/counts.json"
printf '验收日志目录：%s
' "$G2_OUT"
```

贴回：head SHA、Node/npm 版本、逐文件结果、全套末尾文件/用例计数与 full.json、typecheck/server-entry/release 检查结果、c7.log 和 c7-artifacts/report.json；如有超时补证一并提供。保留失败命令的完整日志。不要把原全套失败计数改写成补跑后的“全绿”；全套与单跑证明分别报告。确认前后 SHA 相同且工作区没有源代码变化。
