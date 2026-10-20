# 第三方内容与免责声明

## Riot Games

HEX 自动战棋是免费、非商业的粉丝项目，复刻《云顶之弈》（Teamfight Tactics）第 13 赛季 14.24b 版本。本项目与 Riot Games 没有任何关联，也未获其认可。

HEX is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

以下内容的权利属于 Riot Games，按 Riot 面向同人作品的 [Legal Jibber Jabber](https://www.riotgames.com/en/legal) 政策使用，**不在本仓库任何开源许可证的授权范围内**：

| 内容 | 位置 | 来源 |
| --- | --- | --- |
| 英雄头像、羁绊、装备、强化、野怪图标 | `public/assets/s13/` | 由 `scripts/fetch-s13-assets.cjs` 从 CommunityDragon 的 14.24 游戏文件镜像下载，清单带 sha256 |
| 游戏数据（英雄与技能数值、物品、中英文文本表等） | `src/simulation/content/source/s13-14.24b/raw/` 及由它整理出的 `normalized/` | CommunityDragon 14.24 游戏数据导出 |
| 英雄、羁绊、装备、强化的名称和描述文字 | 散见于 `src/simulation/content/` 与界面 | 同上 |
| 《英雄联盟》《云顶之弈》《双城之战》等名称和商标 | 全仓库 | Riot Games, Inc. |

如果你基于本项目做二次开发：

- 不要用于商业目的，不要收费，不要把 Riot 素材当成你的作品再授权给别人。
- 遵守 Riot 当时有效的同人作品政策；政策变化或 Riot 提出要求时，相关素材必须移除。

## 不在仓库里的内容

- **3D 模型、贴图、骨骼、动作和特效**：同样有版权，只放在开发者本机的 `assets3d-local/` 目录（已加入 `.gitignore`），代码只读一个可配置的素材地址。仓库和 CI 只使用可公开获取的占位素材或纯测试数据。请勿提交这类文件。
- **Riot 的原画、字体、音效文件**：未使用。界面只模仿《云顶之弈》的布局、流程和信息层级。

## 开源依赖

运行时依赖 [Phaser](https://github.com/phaserjs/phaser)（MIT）和 [ws](https://github.com/websockets/ws)（MIT）；开发依赖见 `package.json`，各自遵循其许可证。
