// Private report contains source clip names and evidence; keep it in the ignored root.
import { readFile } from 'node:fs/promises';
import { safeInputPath, writeOutputFile } from './safe-path.mjs';
import { join, resolve } from 'node:path';
const root = resolve('assets3d-local/cast-picks');
const manifest = JSON.parse(await readFile(await safeInputPath(root, join(root, 'manifest.json')), 'utf8'));
let text = `# Cast 动作近似选择

本地普通 manifest：\`assets3d-local/cast-picks/manifest.json\`，与 all-anim 使用同一 schema，仅含以下五个模型。
每个模型保留完整动作映射，cast 为选中动作；模型条目附带 \`approximated: true\`、\`basis\` 和 \`confidence\`。
保留基础 GLB 的模型、贴图及既有动作，仅追加选中片段；全部选择均为表现近似，不调整规则或技能时机。
完整候选动作与时长只写入本地 \`assets3d-local/cast-picks/candidates.json\`，不得提交。

离线重新生成：\`node scripts/assets3d/cast-picks.mjs\`；更新本地 choices.md：\`node scripts/assets3d/cast-picks-doc.mjs\`。
设置 \`CHROMIUM_PATH\` 后运行 \`node scripts/assets3d/cast-picks-browser-review.mjs\`；截图位于本地 \`review/<英雄 ID>.png\`，以原速片段的 50% 位置采样。
仅重截阿木木可追加 \`--unit amumu\`，验收报告写入本地 \`review/amumu-report.json\`。
素材、报告和浏览器缓存仅写入 cast-picks 本地目录，来源只读；脚本不下载素材。

当前分支使用 #308 的 \`merge-fx-roots.mjs\`，按 ID 采用最后一个根的完整模型条目及对应 GLB，无专用覆盖表。
合并命令（路径为占位符；输入须在 assets3d-local 内，输出须在 assets3d-local/fx-pilot 内）：

\`\`\`sh
node scripts/assets3d/merge-fx-roots.mjs --roots "<all-anim根>,<其他效果根>,<cast-picks根>" --out "<新的合并输出目录>"
\`\`\`

cast-picks 必须放在最后；完整动作映射随模型整体覆盖，其他模型及效果沿用前面的根。
该命令供后续集成使用，本次未运行合并，以遵守素材仅写入 cast-picks 的范围。
`;
for (const [id, entry] of Object.entries(manifest.models)) {
  text += `\n## ${id}\n\n选择：\`${entry.animations.cast}\`（approximated；可信度：${entry.confidence}）。\n\n${entry.basis}\n`;
}
await writeOutputFile(join(root, 'choices.md'), text, { force: true });
