# CI153 B4重触发模块组

[run37867121590](https://github.com/catfish-xn/cat/actions/runs/37867121590)，[完整artifact](https://github.com/catfish-xn/cat/actions/runs/37867121590/artifacts/11588394030)。定义0399167、source97f38a0、Chromium153.0.8010.12、dev-module空白页。

四组各2战预热，随后6窗，每窗每组30战，合计720个自然结束战斗、1,176,660个即时消费的战斗事件。每战均有目标装备路径活动；无完整state/events跨战保存。source/fixture始末和harness SHA均核对。完整小artifact原始文件随本目录保存，整包SHA/CRC核验通过。

| 窗口 | post-GC usedSize B | delta B |
| --- | ---: | ---: |
| 起点 | 3,125,812 | — |
| 1 | 3,297,264 | +171,452 |
| 2 | 3,330,132 | +32,868 |
| 3 | 3,346,396 | +16,264 |
| 4 | 3,359,768 | +13,372 |
| 5 | 3,368,532 | +8,764 |
| 6 | 3,366,820 | −1,712 |

六窗净增241,008 B；释放固定harness闭包后3,335,412 B，较起点+209,600 B。增量逐窗变小、末窗回落，本次没有呈现等速跨战累积；不能将其外推为完整Phaser应用无泄漏，也不能无对照地归因某件装备。未设置新的内存门禁，completed只说明执行和覆盖检查完成。

原始b4-module.json还记录GC前末尾值（不是全程峰值）、各组事件/状态reason、RNG、runtime/状态贡献/周期任务最大条目数。详细数值与脚本范围见docs/H1_B4_MODULE_LOAD.md。
