# v20-black-market（2026-10-22）

父 epoch：`v20-live-combat`。集成基线/施工 HEAD：`42d8a4048409dc60e9b1f9647b398cb20e4529af`。只修改规则、测试、脚本和文档；历史 epoch 字节不变。

黑市每次按原档位和源权重抽一个完整奖励包，使用原三候选抽样的第一次抽样，只耗一个 word。玩家接受整包或保留微光；超时继续保留。没有修改金币、装备、微光、生命成长或其他权重。包内原子发放/后续工具、法球、容量处理和唯一收据继续沿用。证据、导出签名及失败/投影说明见 [单包合同](../../BLACK_MARKET_SINGLE_OFFER.md)。

| 标识 | 父 epoch | 当前 |
| --- | --- | --- |
| rules | s13-g2-3-v20-live-combat | s13-g2-3-v20-black-market |
| content | s13-14.24b-g2-3-v20-live-combat | s13-14.24b-g2-3-v20-black-market |
| CONTENT | fnv1a32-utf16:93fad04c | fnv1a32-utf16:9a83da50 |
| LOOT_REPLAY | fnv1a32-utf16:49eb9cf0 | fnv1a32-utf16:e0eb43e2 |
| schema / save / replay / command | 11 / 7 / 5 / 5 | 11 / 7 / 5 / 5 |
| NET / 规则侧多人契约 | 6 / 5 | 6 / 5 |

数据结构不变，无需 schema 升级。严格拒绝旧身份、无迁移；不得只替换身份标签恢复旧存档。发布时应结束旧对局并同步客户端/服务器。原有 live combat、68 XP、B 补丁16字段、标准 PvE 微光规则保持。

录制工具从父 epoch 独立复制，所有入口离线运行，不写 Git 元数据。独立输出四条整局 golden、cannon/sniper 各67检查点、B8 指纹、C19、五份 Herald 原始输入及公开命令轨迹、transfer 和 live-reveal 审计；CURRENT Herald 与当前消费者指向本 epoch。历史版本化证据、脚本、raw、golden、content baseline、源归档及受保护 manifest 均只读。受保护 `g2-4b-herald-raw/manifest.json` SHA256 仍为 `b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`。

```sh
export PATH=$HOME/.local/bin:$PATH
node scripts/update-content-identities.cjs --check
node scripts/verify-v20-black-market-epoch.cjs --write
node scripts/verify-v20-black-market-epoch.cjs
node scripts/v20-black-market-fixture-audit.cjs --baseline-commit=42d8a4048409dc60e9b1f9647b398cb20e4529af
```

`record-v20-black-market-{release,inputs,live-reveal}.cjs` 必须带上述 `--baseline-commit`；加 `--check` 只比较。transfer 支持 `--check`。Herald 默认为核验，`--write` 显式生成。verify 的11步继承原验收门槛，不运行全套测试或改 CI。digest 对照脚本从父 Git blob 与当前源码分别重算完整根。

RNG 风险：每个原三候选 offer 少用两词，后续 G23 黑市/冠冕结果可能变化。市场前后顺序不变；新 epoch 隔离旧轨迹。客户端暂未改成两个按钮，需 Claude 按 UI_REQUESTS 接线，服务器按现有合同验收。

断言等价变更、文件清单和测试计数见 [VALIDATION](VALIDATION.md)。
