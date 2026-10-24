# 增强符文 UI 文本拆包报告（2026-10-25）

分支 `codex/augment-text-chunk`，起点 `b2acbb1f7e4d4ec4f1c00b621902d733cc07559b`。未提交；未修改 `.git`、预算脚本/阈值、身份常量、版本、历史证据和 v2* 夹具。

## 移动内容与加载方式

- batch1/batch2 共 93 行的中文名称和说明移至 `src/presentation/augment-pool-text.ts`。奖励、数值、apiName、tier、traits、enabled、来源定位继续静态存在；领域 ChoiceDefinition 的名称和说明用 id 占位，展示经 `augment-display.ts` 读取。
- 增强中文模板、图标索引一起进入 `assets/ui/augment-text-*.js`。增强三选卡、已选强化提示、对手强化、通用强化选项读取展示文本/图标时才动态请求；不由入口预加载。
- 为处理本环境比题述更大的实测基线，技能中文模板、羁绊原文/展示注释、角色推荐装备、微光装备展示模板另放 `assets/ui/tooltip-text-*.js`。普通提示请求此 chunk，不会提前请求增强文本。
- 两个 loader 分别合并在途请求并缓存结果。加载时显示加载提示，成功后刷新仍存活的卡片、提示与相关面板；销毁时取消订阅。失败显示刷新重试提示，不产生未处理的 import rejection，不自动循环请求；loader 也支持显式重试。
- 离线摘要工具通过 `scripts/augment-content-archive.ts` 补回原始名称、说明及英文来源列，完整摘要覆盖不缩水。纯 UI chunk 不导入应用入口、规则或 2D/3D 实现；服务端构建不依赖 UI 文本或归档工具。

## 字节口径

与现有预算一致：逐文件 gzip level 9，累加顶层 `dist/assets/*.js`，不计 `assets/3d/**` 和按需 UI 数据目录。未改 `scripts/m7-budget.cjs`。

- 用户提供的此前体积：647,714 字节，1.524883×。
- 本环境使用未修改 HEAD 原文件、相同生产配置重新构建：657,114 字节，1.547013×；比题述多 9,400 字节，以实测为对照，不冒称两者相同。
- 最终体积和每个延迟 chunk 的字节数见本报告末尾的最终验证结果。
- 优选目标 628,649 字节尚未达到，硬门槛保持 637,144 字节。

## 指定测试与既有失败

指定范围（`tests/*augment*`、`tests/presentation/*`、production-size、3D isolation/budget、content identity、opening random identity）外加受影响的 trait/ability 文本测试：41 个文件、966 项通过、205 项失败。没有运行全量测试。

逐项比较未修改 HEAD 的失败名称，205 项全部已存在，没有新增失败。基线源文件通过临时只读 load 插件复用，未改 Git、身份或夹具；临时配置已删除。失败分布：

| 文件 | 既有失败数 |
| --- | ---: |
| augment-pool-batch2 | 1 |
| augment-tier-consistency | 1 |
| content-identity-constants | 2 |
| g2-augments-choice | 50 |
| g2-augments-combat | 5 |
| opening-random-identity | 136 |
| s13-augments-p2-choice | 3 |
| s13-augments-p2-multiplayer | 6 |
| scripts/tests/production-size | 1 |

既有完整内容重算摘要为 `fnv1a32-utf16:30d7827d`，loot 为 `fnv1a32-utf16:0eb630e2`，与本次拆分后完全相同；仓库冻结常量仍是 `d298bab2` / `d58c0cb4`，production-size 测试还固定期待更早的 `2ee7d9d2` / `84b3b60c`。其余失败包括旧选择种子、开局回放及候选池预期。遵守本任务约束，没有更新这些常量/夹具，也没有改规则来迁就旧预期。

最终数据调整后复跑展示、两类 loader、所有 batch 文本、原始摘要保真、两个服务器入口构建隔离、3D 构建边界和预算：15 个文件、226 项全部通过。3D chunk 不静态导入 2D/UI；UI 数据动态可达、静态不可达且无反向依赖；新增生产构建断言保持原硬限。

约定已以 P、2026-10-25 记录于 `docs/S13_RULES_GAP.md`。验收尚不能称为全部通过：205 项既有失败，以及未达到优选体积目标，均明确保留。

## 最终验证结果

- `npm run build`：通过（Node 22.23.4、实际安装的 Vite 7.3.6）。
- `npx tsc --noEmit -p .`：通过。
- 顶层 JS：**635,570 字节，1.496293×**，比同环境 HEAD 减少 **21,544 字节**；距硬限 **1,574 字节**。相比题述 647,714 减少 12,144 字节。
- 顶层明细：入口 `index-BDzo8Vlg.js` 478,804；Phaser 156,766 字节。
- 按需增强文本 chunk：6,658 字节；其他提示文本 chunk：15,295 字节。两项均按 gzip level 9 单列。3D chunk 保持独立，未将任何 2D/规则模块迁入 3D 目录。
- 未达优选目标 628,649，差 6,921 字节；当前预算余量较小，后续内容增加仍须运行原有预算检查。
- `git diff --check` 通过；生成的 dist、测试日志及基线构建保留在忽略目录或 /tmp，不提交。
