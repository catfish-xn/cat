# v25 星夜内容身份字节钉核对

核对起点：`claude/v25-starry-pins`，HEAD `e0147d72d8e8cf3fae8f7cfbe61775dc169250d3`。只更新测试钉值与兼容基线，不改 `src/`、断言、阈值或超时。

## 证明方法与身份字段

用独立临时 Vitest 用例复用原测试的公开命令与 B9 原生逐 tick 参考过程，导出当前字节；原测试在证明完成前保持原样。对导出的原始字符串仅作以下两项等长替换，不解析重排 JSON：

```ts
const restoredOldBytes = currentBytes
  .replaceAll('fnv1a32-utf16:f671ab88', 'fnv1a32-utf16:229d9f7e')
  .replaceAll('fnv1a32-utf16:36ebfac2', 'fnv1a32-utf16:55f72339');
```

第二项是派生的 loot 回放身份：`scripts/loot-replay-digest.ts` 的摘要根包含完整规则 manifest，`scripts/augment-content-archive.ts` 将内容及说明归档纳入该根；它并非只覆盖掉落数值，也并非直接对 `contentDigest` 字符串求哈希。旧身份对来自 `97068956:src/simulation/content/identity-constants.ts`，新身份对来自当前同文件。只替换 `contentDigest` **不足以**还原基线，必须同时还原这个派生身份字段。

逐项字段位置如下；除这些身份字段外没有字节差异，也没有需要重算的战斗、事件或终态哈希：

| 钉值 | contentDigest 路径 | 派生 replayDigest 路径 |
| --- | --- | --- |
| pre-Spoils round 1 | `$.contentDigest`、`$.combatInputBasis.contentDigest` | `$.m8.loot.frozen.replayDigest` |
| pre-Spoils round 2 | `$.contentDigest`、`$.combatInputBasis.contentDigest` | `$.m8.loot.frozen.replayDigest` |
| Swarm save | `$.contentDigest`、`$.combatInputBasis.contentDigest`、`$.augmentHistory.proof.origin.contentDigest` | `$.m8.loot.frozen.replayDigest`、`$.augmentHistory.proof.origin.m8.loot.frozen.replayDigest` |
| B9 record | `$.version.contentDigest`、`$.context.contentDigest` | `$.context.m8.loot.frozen.replayDigest` |

## 每个钉值的证明与新值

下表均为 SHA-256。pre-Spoils 两个参数用例各自生成同一个首轮结算基线：两次均先将还原后的完整字符串与更新前的 `tests/fixtures/compat/pre-spoils-v25-seed42.json` 逐字节比较，完全一致；表中同时记录文件哈希。Swarm 与 B9 只有旧哈希，故对还原后的完整字符串求哈希并与原断言比较，均完全一致。

| 钉值 | 还原身份后的 SHA-256（等于旧钉值） | 当前新 SHA-256 |
| --- | --- | --- |
| pre-Spoils round 1（28,280 字节） | `eb9ad8b9bbbd295ddeb73a4950e7b6d26571ef9d08f4373560443bc40deadea1` | `b4570b2bc1d919b4992fc6bd1ab511779a13b3ca1caa0264f938404fd5a3b221` |
| pre-Spoils round 2（28,280 字节） | `eb9ad8b9bbbd295ddeb73a4950e7b6d26571ef9d08f4373560443bc40deadea1` | `b4570b2bc1d919b4992fc6bd1ab511779a13b3ca1caa0264f938404fd5a3b221` |
| Swarm save（57,634 字节） | `ea42cda1eeab49ebc9c4e012b17214218092cf55d5653adb6b41ebc6f4e760bc` | `8dedd86620e10240b954970b1f2c544e9dc8275ab65c5c5a2bb59c889bd8178d` |
| B9 record（5,649,491 字节） | `4371559d3bd53b99b3dfd91d6b48b6180a2fd7af90b63cfd86215a21979cec46` | `64fb5f0af6a6d507d574c2ba2e6db53d291dc296d1d66671f797a583ce7d6566` |

B9 其余三个 SHA-256 钉值逐一通过原断言，保持不变：

| 钉值 | 核对通过的当前值（等于旧值） |
| --- | --- |
| 全部 685 帧的 tick/hash 集合 | `cf8c0c9136360c088e39d1259b8fd4bdf44d0940bb482be12c335b9b651a2a6d` |
| 6,760 项事件账本 | `c619dab88165e2ee1e3ca6a5e01c2eb0387fdabf69d1d8d79e35588b2345a519` |
| tick 684 终态 | `c4c0d27c2df046bd5f9986873249715bfa97950a3238544555efd3e532091d8d` |

临时证明用例 4/4 通过后才更新两处哈希与 v25 fixture；v23/v24 fixture 保持原样。临时用例不纳入提交，避免复制现有长对局测试。兼容基线由旧文件仅替换上述身份字段得到，未用当前规则重新生成玩法数据。

## 验证命令

```sh
export PATH=$HOME/.local/bin:$PATH
npm test -- --configLoader runner --maxWorkers=3 tests/augment-pool-batch3-progress.test.ts tests/augment-pool-batch5-g4-swarm.test.ts tests/m6-playback-checkpoints.test.ts
npm run typecheck
```

结果：指定 3 个文件全部通过，30/30 测试通过（26.42 秒）；`tsc --noEmit` 退出码 0。最终反向替换后的 fixture 仍与 HEAD 旧文件逐字节一致，`git diff --check` 通过，`src/` 无差异，三个文件的断言数量保持 40/45/30，所有阈值和超时保持原值。未写入 `.git`，由执行端提交。
