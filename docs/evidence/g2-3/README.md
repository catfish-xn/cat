# G2-3 新源文件入库（SRC-MAP22）

## 扩展来源

下载日期：2026-10-16。来源均为 CommunityDragon `14.24`，归档于 `src/simulation/content/source/s13-14.24b/raw/`。
9 个文件全部保留完整原始字节，以 gzip level 9、`mtime=0`、空文件名头压缩；未抽取子集，未重新序列化 JSON。
最大压缩文件约 4.43 MB，未发现另设的源文件大小限制，低于 GitHub 单文件限制，因此无需抽取规则。

原始字节数与 SHA256 使用 manifest 的 `bytes` / `sha256`；gzip 字节数与 SHA256 使用 `archiveBytes` / `archiveSha256`，与既有 `en_us.json.gz` 的口径一致。
完整下载 URL、下载 UTC 时间、用途和双份哈希记录在 `provenance/manifest.json` 的 `extendedSourceAcquisition.sources`。下载时间取本次下载文件的本地最后写入时间，不使用服务器的 Last-Modified。

**补丁边界：** `14.24` 目录是 B 补丁之前的客户端数值。包括征服者每箱 5% 在内的 B 补丁差异，继续依据补丁说明显式覆盖，遵循既有 `provenance/source-policy.json` 的来源优先级。本单只补源文件，不新增或改动覆盖，不改运行时内容或 digest。

**中文路径：** `game/zh_cn/data/menu/zh_cn/tft.stringtable.json` 返回 404；目录索引显示实际路径仍含 `menu/en_us/`，下方记录实际下载 URL。此 stringtable 不是 `cdragon/tft/zh_cn.json`，不将既有 manifest 的该缺失项标记为完成。

### 1. `map22.bin.json`

- URL：<https://raw.communitydragon.org/14.24/game/data/maps/shipping/map22/map22.bin.json>
- 归档：[`map22.bin.json.gz`](../../../src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz)
- 用途：G2-3 GoopBuff 异变、四名双形态单位 FormSwapperStats、ArmoryTable_TFT13_Warband_Cashout1…20 / CashoutBreakpoints、TFT13_Crime_BlackMarket1…8 及 Loot 权重表的完整原始来源。
- 原始：54,544,106 字节；SHA256 `09a9219647c08e70a8eb4d2ccbc35a9afe21934bc5279b4da2d05ca076339e0f`。
- gzip：4,427,277 字节；SHA256 `743bf3668141be28d44b39160dcfc0da0aca0e919e6aa14513a0b3feb666b2b0`。

### 2. `en_us.tft.stringtable.json`

- URL：<https://raw.communitydragon.org/14.24/game/en_us/data/menu/en_us/tft.stringtable.json>
- 归档：[`en_us.tft.stringtable.json.gz`](../../../src/simulation/content/source/s13-14.24b/raw/en_us.tft.stringtable.json.gz)
- 用途：TFT13_GoopBuff_*_Title / _Description 英文名称与描述及其原始占位符，供后续语义核对。
- 原始：15,272,538 字节；SHA256 `4951a0356e8d9ac7f59b3b54360c964d65baea8112bcbd8da23b8540df07a443`。
- gzip：2,740,724 字节；SHA256 `1a96281672670a865cea018b7b2c447ead04e74b7a6800984749cb0f71732e8e`。

### 3. `zh_cn.tft.stringtable.json`

- URL：<https://raw.communitydragon.org/14.24/game/zh_cn/data/menu/en_us/tft.stringtable.json>
- 归档：[`zh_cn.tft.stringtable.json.gz`](../../../src/simulation/content/source/s13-14.24b/raw/zh_cn.tft.stringtable.json.gz)
- 用途：异变等简体中文名称与描述，供后续界面文案使用；不在本单接入界面。
- 原始：15,365,105 字节；SHA256 `aa9ca3629482cdde5356a38c1f83c804fdcc20e2b6315cc872e6a9800dbacda3`。
- gzip：3,068,733 字节；SHA256 `ae17b0ce7ebc199e3b3c8dbc7fc906cfb0a83a1c45a9d6ce2d4a78e1526ebca4`。

### 4. `tft13_elise.cdtb.bin.json`

- URL：<https://raw.communitydragon.org/14.24/game/characters/tft13_elise.cdtb.bin.json>
- 归档：[`tft13_elise.cdtb.bin.json.gz`](../../../src/simulation/content/source/s13-14.24b/raw/tft13_elise.cdtb.bin.json.gz)
- 用途：Elise 双形态角色与技能原始数据。
- 原始：242,677 字节；SHA256 `70fb6dd4a4de9e9eb5c656d692ac6890b51822c72206e454bd93d8c3c83463c8`。
- gzip：25,370 字节；SHA256 `4884fba9fcc9adcbfcfd946cc8692b93a27792beeb09d4f4afd5d7bc1558e2f7`。

### 5. `tft13_swain.cdtb.bin.json`

- URL：<https://raw.communitydragon.org/14.24/game/characters/tft13_swain.cdtb.bin.json>
- 归档：[`tft13_swain.cdtb.bin.json.gz`](../../../src/simulation/content/source/s13-14.24b/raw/tft13_swain.cdtb.bin.json.gz)
- 用途：Swain 双形态角色与技能原始数据。
- 原始：148,554 字节；SHA256 `1b1a668b51739a89cf37ad33e788738bae366c54899a40766a6b9b85f16fcc0d`。
- gzip：15,288 字节；SHA256 `41e3de058501408540e29ed9d02c73b13fd5d7e0262c9cde89d5d7c3d402b810`。

### 6. `tft13_jayce.cdtb.bin.json`

- URL：<https://raw.communitydragon.org/14.24/game/characters/tft13_jayce.cdtb.bin.json>
- 归档：[`tft13_jayce.cdtb.bin.json.gz`](../../../src/simulation/content/source/s13-14.24b/raw/tft13_jayce.cdtb.bin.json.gz)
- 用途：Jayce 双形态角色与技能原始数据。
- 原始：444,152 字节；SHA256 `30b73215c710c88013714fce9c9538dfa3df7cccedc74456d375334b181dd153`。
- gzip：41,136 字节；SHA256 `c1b4c1dfc08eca05ec180cb6585a71ac8d61ec3395a3103e7cfe8974a6f78d11`。

### 7. `tft13_gangplank.cdtb.bin.json`

- URL：<https://raw.communitydragon.org/14.24/game/characters/tft13_gangplank.cdtb.bin.json>
- 归档：[`tft13_gangplank.cdtb.bin.json.gz`](../../../src/simulation/content/source/s13-14.24b/raw/tft13_gangplank.cdtb.bin.json.gz)
- 用途：Gangplank 双形态角色与技能原始数据。
- 原始：128,788 字节；SHA256 `38a38489a8e911680d1334047765933c44b2c1d61236fc80fb4457a6e2256f0d`。
- gzip：13,801 字节；SHA256 `e6529a6c4e3d625e0ae7c9e0ad749fc707e6c5aa0c0bb51f1a2d02a16a048a95`。

### 8. `tft13_jaycesummon.cdtb.bin.json`

- URL：<https://raw.communitydragon.org/14.24/game/characters/tft13_jaycesummon.cdtb.bin.json>
- 归档：[`tft13_jaycesummon.cdtb.bin.json.gz`](../../../src/simulation/content/source/s13-14.24b/raw/tft13_jaycesummon.cdtb.bin.json.gz)
- 用途：Jayce 召唤物角色与技能原始数据。
- 原始：95,320 字节；SHA256 `f9410801ae051c3544a8d44182d95a0b54a0bbd6a9b3e98869d892733eb88c69`。
- gzip：11,320 字节；SHA256 `b6f0e514a1c6f7edb8998b1aa1a3b1439407b1ef351e7bcc154626130f0e2951`。

### 9. `tft13_gangplankbarrel.cdtb.bin.json`

- URL：<https://raw.communitydragon.org/14.24/game/characters/tft13_gangplankbarrel.cdtb.bin.json>
- 归档：[`tft13_gangplankbarrel.cdtb.bin.json.gz`](../../../src/simulation/content/source/s13-14.24b/raw/tft13_gangplankbarrel.cdtb.bin.json.gz)
- 用途：Gangplank 火药桶角色与技能原始数据。
- 原始：9,419 字节；SHA256 `da19ad7222ddbaff34c0ada98e935042931239c150ca2da2000e066d39a5f71e`。
- gzip：1,776 字节；SHA256 `ed8f92e84e87d8005258e5121e016636b05c50a690bf3b96692bcac2d3e422c7`。

## 哈希校验记录

9/9 文件的 gzip 长度与 SHA256、解压长度与 SHA256 均与 manifest 一致，且解压字节与本次下载文件逐字节一致。
map22 的原始长度为 54,544,106 字节，英文 stringtable 为 15,272,538 字节；两者 SHA256 均符合派单提供的前缀及末尾。派单未给出完整参考哈希，本文记录实际下载计算出的完整值，不将前后缀比对称作完整参考哈希比对。
验证边界仅为文件字节、哈希与 manifest 一致性；没有运行测试、类型检查、构建、规则或玩法验证，也没有新增测试内容。
