# 强化图标双来源审计（第二轮）

审计基线：`bc818fd8`，工作区分支 `icons`。本轮仅修改审计脚本、结构测试和本文；未修改界面、规则、素材或 Git 元数据，留给 Claude 提交。

## 结果

- 全量强化 310 个（包含 D5 四张）；来源=打包 57 个，来源=素材根 9 个，来源=两者都无 **244 个**。
- 第一轮的 253 个是“缺打包映射”，不能作为实际缺图数。本轮素材根清单补足 9 个，完整双来源缺图清单见下文。
- 打包映射 57 条，本地普通文件均存在，缺文件 0；打包远程目标 0。
- 素材根 `kind:'augment'` 条目 9 条，均通过运行时路径校验，忽略 0 条；其 path 全部列于下表，未请求远程 URL，也未将它们误当作仓库本地文件检查。
- 打包重复 ID 0 组、重复目标路径 0 组、重复来源 URL 1 组（`placebo`、`placebo-plus`，manifest 已注明有意共用）。

输入为用户提供的测试服只读副本：`/data/aiapps/tmp/icons/ui-assets.json`。
输入 SHA-256：`a5aef30afd73bfe676a53b1411e283abb2f712d6c0aff3428d05f0eec1e96869`。

“真实缺图”在本报告中指：打包清单和这份测试服素材根清单均无可用映射。清单中有映射不代表远程文件一定能加载；本轮未验证网络可用性、图片内容或图片哈希。素材根需要已配置且运行时清单成功注册。

## D5 四张（单列，亦包含在 244 个总清单中）

| ID | 名称 | 来源 | 素材根 path |
| --- | --- | --- | --- |
| `brb` | 假装摸鱼 | 两者都无 | 无 |
| `over-encumbered` | 运力不足 | 两者都无 | 无 |
| `restart-mission` | 重启任务 | 两者都无 | 无 |
| `what-you-really-are` | 真心本色 | 两者都无 | 无 |

## 素材根补足的 9 个强化及原始 path

下列强化均无打包映射，来源=素材根；相对 path 在运行时拼接到配置的 3D 素材根，不推测部署根 URL。

| ID | 素材根条目 path |
| --- | --- |
| `mentorship` | `assets/s13/augments/mentorship.png` |
| `reunion` | `assets/s13/augments/reunion.png` |
| `geniuses` | `assets/s13/augments/geniuses.png` |
| `menaces` | `assets/s13/augments/menaces.png` |
| `unlikely-duo` | `assets/s13/augments/unlikely-duo.png` |
| `sisters` | `assets/s13/augments/sisters.png` |
| `all-for-one-i` | `assets/s13/augments/all-for-one-i.png` |
| `trifecta-i` | `assets/s13/augments/trifecta-i.png` |
| `spirit-link` | `assets/s13/augments/spirit-link.png` |

## 三个界面的回退检查（只读，未改代码）

结论：**未发现只查打包清单、漏掉 rootAugmentIconUrl 回退的界面。**

| 文件:行 | 查找链及结论 |
| --- | --- |
| `src/rendering/strategy-panel.ts:474` | 已选强化调用 `augmentIconOrBadgeHtml`；经 `augmentIconHtml` → `augmentIconUrl` 回退到素材根。 |
| `src/rendering/strategy-panel.ts:1167` | 强化选择卡调用 `augmentIconOrBadgeHtml`，走同一回退。 |
| `src/rendering/strategy-panel.ts:1378` | 通用奖励中的强化调用 `augmentIconHtml`，走同一回退。 |
| `src/rendering/online/opponent-board.ts:167` | 对手强化调用 `augmentIconOrBadgeHtml`（导入在第 24 行），走同一回退。 |
| `src/presentation/augment-display.ts:49` | `augmentIconUrl` 第 50 行查打包清单，第 51 行缺映射时调用 `rootAugmentIconUrl(id)`；第 55–57 行 `augmentIconHtml` 与第 64–65 行 badge 共用该入口。 |

素材根读取入口为 `src/presentation/s13-assets.ts:22`；第 34–40 行仅接受有效的 `kind:id:path` 条目，第 45 行导出 `rootAugmentIconUrl`。本次检查的是查找链，未做浏览器时序或网络加载验收。

## 脚本与输出结构

`scripts/audit-augment-icons.mjs` 新增可选参数 `--ui-assets <path>`，仅从本地读取 JSON。全量枚举 `AUGMENT_DEFINITIONS`，不按强化启用状态、层级或批次过滤。

- 保留原有 `schemaVersion:1` 与打包核查字段；新增 `uiAssetsFile`、`rootMappings`、`missingBothIds` 及素材根汇总数字。
- 每个 `augments[]` 条目增加 `iconSource`（打包/素材根/两者都无）、`rootPaths`、`rootMappingIndices`、`effectiveRootMappingIndex`；JSON 和中文摘要均逐强化标注来源并列素材根 path。
- 打包优先；素材根只计 `kind:'augment'`、字符串 id/path、通过 `/^[\w-]+(\/[\w.-]+)*$/` 且不含 `..` 路径段的条目，与运行时注册规则一致。打包同 ID 首条生效；素材根同 ID 最后一个有效条目生效。
- `rootMappings` 保留全部强化条目的原始 path、原清单索引、`accepted`、忽略原因；`exists:null` 表示未核查部署文件。其他 kind 不参与强化核查。
- 打包目标 `/assets/s13/`、`assets/s13/` 对照 `public/assets/s13/`；绝对 URL、协议相对 URL、`/assets3d/` 只列清单。`source` 仅为下载来源，不当作图标目标。
- 不传 `--ui-assets` 仍支持第一轮打包核查，但会明确提示不能据此判定测试服缺图。参数、读取或解析错误失败退出；发现缺图不导致非零退出。

## 运行与测试

```sh
mkdir -p artifacts
node scripts/audit-augment-icons.mjs --ui-assets /data/aiapps/tmp/icons/ui-assets.json > artifacts/augment-icons.json 2> artifacts/augment-icons-summary.txt
npm test -- tests/audit-augment-icons.test.ts --maxWorkers=2 --configLoader=runner
```

测试服清单重跑成功；详细 JSON 与中文摘要保存在已忽略的 `artifacts/`，未复制素材进仓库。

测试结果：**1 文件、3 测试通过**。保留原有 CLI 冒烟测试全部断言，增加双来源字段结构检查；新增 2 个参数化结构用例（空清单，以及含重复强化、打包重叠、其他 kind、越界路径、远程 URL、无效路径的混合清单）。测试使用临时合成元数据，从仓库外目录执行，文件名含空格；不依赖测试服文件、不要求图标齐全、不锁定缺图数量或具体覆盖结果。

使用 `--configLoader=runner` 沿用第一轮方式，避免默认配置加载器写只读的 `node_modules/.vite-temp`；未提高超时/阈值、未删改弱化断言、未跳过测试。仅跑上述相关测试，未跑全套或 Vite build，未使用 `--write` 重录纪元/golden，未处理 unsupported-version/摘要漂移。

## 打包和素材根都没有的完整清单（244 个 ID）

```text
a-change-of-fate
a-golden-find
academic-research
academy-crest
academy-crown
aerial-warfare
all-out
all-that-shimmers
all-that-shimmers-plus
ambusher-crest
ambusher-crown
an-exalted-adventure
anger-issues
another-anomaly
artifactory
artillerist-crest
artillerist-crown
at-what-cost
automata-crest
automata-crown
bad-luck-protection
band-of-thieves-i
beggars-can-be-choosers
betrayal
big-grab-bag
birthday-presents
black-rose-crest
black-rose-crown
blade-dance
blazing-soul-i
blazing-soul-ii
blood-brothers
blood-pact
branching-out
brb
bruiser-crest
bruiser-crown
build-a-bud
building-a-collection-iii
call-to-chaos
called-shot
caretakers-ally
caretakers-chosen
caretakers-favor
category-five
chem-baron-crest
chem-baron-crown
clear-mind
cloning-facility
cluttered-mind
component-buffet
conqueror-crest
conqueror-crown
contested
cooking-pot
coronation
corrosion
crafted-crafting
crimson-pact
dark-alley-dealings
dhampyr
diversified-portfolio
diversified-portfolio-plus
dominate
dominator-crest
dominator-crown
dual-purpose
dummify
duo-queue
enforce
enforcer-crest
enforcer-crown
epoch
epoch-plus
expected-unexpectedness
experiment-crest
experiment-crown
eye-for-an-eye
eye-for-an-eye-plus
family-crest
family-crown
field-medic
final-polish
fine-vintage
firelight-crest
firelight-crown
firesale
flexible
forbidden-magic
forward-thinking
fractured-crystals
ghost-of-friends-past
glorious-evolution
gold-for-dummies
golemify
good-for-something
greater-moonlight
hall-of-mirrors
hard-commit
head-start
heavy-hitters
heroic-grab-bag
im-the-carry-now
invested-plus
invested-plus-plus
iron-assets
item-grab-bag-i
kingslayer
lategame-specialist
latent-forge
level-up
living-forge
long-distance-pals
loot-explosion
lucky-gloves
lucky-gloves-plus
lunch-money
mad-chemist
magic-roll
max-cap
mirrored-monetization
missed-connections
moonlight
natural-selection
no-scout-no-pivot
noble-sacrifice
noxian-guillotine
one-buff-two-buff
one-two-five
ones-twos-three
over-encumbered
overheal
pandoras-bench
pandoras-items
pandoras-items-ii
pandoras-items-iii
patience-is-a-virtue
patient-study
phreaky-friday
phreaky-friday-plus
pilfer
pit-fighter-crest
pit-fighter-crown
pit-fighter-prizefighter
power-up
prismatic-pipeline
prismatic-ticket
prizefighter
quality-over-quantity
quickstriker-boost
quickstriker-crest
quickstriker-crown
radiant-refactor
raining-gold
raining-gold-plus
rebel-crest
rebel-crown
rebel-resurgence
recombobulator
reinfourcement
replication
reroll-transfer
restart-mission
rigged-shop-plus
risky-moves
rocket-collection
rocket-collection-plus
roll-the-dice
rolling-for-days-i
salvage-bin
salvage-bin-plus
sated-spellweaver
savage-revenge
scapegoat
scavenger
scoreboard-scrapper
scrap-crest
scrap-crown
scrap-recycling
sentinel-crest
sentinel-crown
sentinel-slam
shimmerscale-essence
shocking-troll
shop-glitch
shopping-spree
silver-spoon
slammin
slammin-plus
sniper-crest
sniper-crown
snipers-nest
sorcerer-crest
sorcerer-crown
sorcerer-explosion
spoils-of-war-i
spoils-of-war-ii
spoils-of-war-iii
sponging
starry-night
starry-night-plus
subscription-service
superstars-i
superstars-ii
support-cache
support-mining
support-mining-plus
survivor
table-scraps
tacticians-kitchen
team-building
teaming-up-i
teaming-up-ii
the-golden-egg
tiniest-titan
tiniest-titan-plus
titanic-titan
tomb-raider-1
tomb-raider-2
tower-defense
trade-sector
trait-tracker
two-much-value
two-trick
upward-mobility
visionary-crest
visionary-crown
void-swarm
voidcaller
wandering-trainer-i
wandering-trainer-ii
warpath
watcher-crest
watcher-crown
watcher-growth
wealthy-rehab-i
wealthy-rehab-ii
welcome-to-the-playground
what-doesnt-kill-you
what-you-really-are
why-not-both
worth-the-wait
worth-the-wait-ii
young-and-wild-and-free
```

## 待处理

双来源缺图 244 个（含 D5 四张）尚待界面/素材负责人补图；本任务只审计，不修改 manifest 或界面。三个指定界面没有查找回退遗漏。远程部署文件是否存在仍未验证；本轮工作已完成，改动留在工作区由 Claude 审阅提交。
