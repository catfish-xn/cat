# 动画源图附录（只读审计）

来源为 extraction.json SHA-256 校验后的绑定皮肤图（跟随 AnimationGraphData，Amumu 为 skin1）。覆盖全部 60 个单位，包含原缺 cast 的 23 个单位及全部 hit 检查。

PROP mClipDataMap 键实际保存 32 位 hash；“图键候选”是本地通用动作词/文件名后缀经 FNV-1a 匹配得到，原始拼写不可恢复，不能视作源字符串。未知键保留 hash；“文件 clip 名”取真实 ANM basename。非 Atomic 项没有直接 ANM，不拼接或冒充动作。

源图选择覆盖（尚非 GLB 重建验收）：cast 37 → 55；hit 0 → 0。

## amumu（原缺 cast）

cast：源数据无此动作 / missing-atomic-action；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_amumu/skins/skin0.bin`；SHA-256：`2640f784232123f1a229a24a81a35b3d3bc7f8c70557b6dcf31088840893607f`
- 源：`data/characters/tft13_amumu/skins/root.bin`；SHA-256：`de296a7c814613d59b09eefa89a29efb3eb4adfb03f023ec55feea1ef87a263d`
- 源：`characters/tft13_amumu`；SHA-256：`05dac238dc8f98d9d1066752a18ea657a0e163d9697b77afd6518538f97b41a4`
- 源：`data/characters/tft13_amumu/animations/skin1.bin`；SHA-256：`1017afd2db7c8386edaeff21582106eb0de3b21387260749d28f8a81141a30d2`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Amumu_Skin23_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Amumu/Skins/Base/Animations/TFT13_Amumu_Skin23_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Amumu_Skin23_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Amumu/Skins/Base/Animations/TFT13_Amumu_Skin23_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Amumu_Skin23_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Amumu/Skins/Base/Animations/TFT13_Amumu_Skin23_Attack1.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Amumu_Skin23_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Amumu/Skins/Base/Animations/Amumu_Skin23_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Amumu_skin23_run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Amumu/Skins/Base/Animations/TFT13_Amumu_skin23_run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Amumu_skin23_idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Amumu/Skins/Base/Animations/TFT13_Amumu_skin23_idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Amumu_Skin23_Dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Amumu/Skins/Base/Animations/TFT13_Amumu_Skin23_Dance.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Amumu_Skin23_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Amumu/Skins/Base/Animations/Amumu_Skin23_Death.TFT_Set13.anm` |

## darius

cast：spell1；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_darius/skins/skin0.bin`；SHA-256：`07be09aa52d0898191ced4c7acd9e8bc984846550730b329b8e094316d6a8b74`
- 源：`data/characters/tft13_darius/skins/root.bin`；SHA-256：`7116774da1a935e7a29979618ddbddb40976e4e8f3e7f291a7e6c0048b39d4bc`
- 源：`characters/tft13_darius`；SHA-256：`4ba7d9bf75a4407a74c6405b20dbb1eace7d5ec9f398162838ede7d16e7d9a30`
- 源：`data/characters/tft13_darius/animations/skin0.bin`；SHA-256：`1e9841166c0bf518f0c10881830b8b107097017852f62eb75783dd746180eafb`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Idle_new.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Dance_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Dance_new.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Spell1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Spell1.TFT_Set13.anm` |
| 未知 | `a062993d` | Atomic | `Spell1_IN.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Spell1_IN.TFT_Set13.anm` |
| 未知 | `5463dad9` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| death_loop | `36fa7cec` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Death.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Darius/Skins/Base/Animations/Death.TFT_Set13.anm` |

## draven（原缺 cast）

cast：spell1_spin_left_right；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_draven/skins/skin0.bin`；SHA-256：`dc750626d9fbc9b9cfd831c641e32d1374aee277481f70ab5c42fcd79886b04a`
- 源：`data/characters/tft13_draven/skins/root.bin`；SHA-256：`fec65933a425c27b2e980fb5b65354971b8864127dcfd7c6385d06bf210e4166`
- 源：`characters/tft13_draven`；SHA-256：`f0f4e9a9871ade4744831fa453191a903ebb65b5ab27898b95282ddaece99eb3`
- 源：`data/characters/tft13_draven/animations/skin0.bin`；SHA-256：`d531b5e5ea9f54601b19aac033c6dfb208f807e34b45a03120a8c3154fe6c399`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Taunt.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Taunt.TFT_Set13.anm` |
| Crit_Left | `e1d47bd3` | Atomic | `Crit_Left.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Crit_Left.TFT_Set13.anm` |
| Idle1_RArmOut | `0538433d` | Atomic | `Idle1_BothArms.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Idle1_BothArms.TFT_Set13.anm` |
| Idle1_BothArms | `852dc41b` | Atomic | `Idle1_BothArms.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Idle1_BothArms.TFT_Set13.anm` |
| 未知 | `3eb29957` | Atomic | `Run_Arms_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Run_Arms_Out.TFT_Set13.anm` |
| 未知 | `1dabde00` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Run.TFT_Set13.anm` |
| 未知 | `eb8258d9` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Run.TFT_Set13.anm` |
| 未知 | `38f2d109` | Atomic | `Run_Arms_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Run_Arms_Out.TFT_Set13.anm` |
| 未知 | `0d6affbb` | 非 Atomic 0x2160b3ec | 无直接 ANM | — |
| 未知 | `8982c6e0` | 非 Atomic 0x2160b3ec | 无直接 ANM | — |
| 未知 | `b6851e23` | Atomic | `Spell1_Arm_Catches.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Spell1_Arm_Catches.TFT_Set13.anm` |
| 未知 | `5047a071` | Atomic | `Spell1_Arm_Catches.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Spell1_Arm_Catches.TFT_Set13.anm` |
| 未知 | `67b51936` | Atomic | `TFT13_Draven_Idle1_RArmOut.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/TFT13_Draven_Idle1_RArmOut.TFT_Set13.anm` |
| 未知 | `1607268f` | Atomic | `Spell1_Spin_Left_Right.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Spell1_Spin_Left_Right.TFT_Set13.anm` |
| 未知 | `1267dfe8` | Atomic | `Spell1_Spin_Left_Right.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Spell1_Spin_Left_Right.TFT_Set13.anm` |
| 未知 | `ba128e00` | Atomic | `Spell1_Spin_Left_Right.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Spell1_Spin_Left_Right.TFT_Set13.anm` |
| 未知 | `207e39fd` | Atomic | `Spell1_Spin_Left_Right.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Spell1_Spin_Left_Right.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Draven/Skins/Base/Animations/Death.TFT_Set13.anm` |

## irelia

cast：tft13_irelia_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_irelia/skins/skin0.bin`；SHA-256：`49e4266f11235a320b43575cf3412a329ae45abd43a63faefc68681823c786c8`
- 源：`data/characters/tft13_irelia/skins/root.bin`；SHA-256：`3835567a6830de71c2408207703882c06fee4e3032b2ceabc0b997fd54ffa33f`
- 源：`characters/tft13_irelia`；SHA-256：`0099b7440e0d41ea4678bcb85d722b257f9e108e54908f0300207ecf9596375e`
- 源：`data/characters/tft13_irelia/animations/skin0.bin`；SHA-256：`8b03e80ce56509e7a5c6cdf52d7d9ef048f955888bd10cdd47798b800c5c3338`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Irelia_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/TFT13_Irelia_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Irelia_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/TFT13_Irelia_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Irelia_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/Irelia_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Irelia_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/TFT13_Irelia_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Irelia_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/TFT13_Irelia_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Irelia_Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/TFT13_Irelia_Celebration.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Irelia_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/TFT13_Irelia_Spell.TFT_Set13.anm` |
| 未知 | `5097eaab` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| SpellAction_Attack | `9d5cd918` | Atomic | `TFT13_Irelia_SpellAction_Attack.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/TFT13_Irelia_SpellAction_Attack.TFT_Set13.anm` |
| SpellAction_toIdle | `0882b1c3` | Atomic | `TFT13_Irelia_SpellAction_toIdle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/TFT13_Irelia_SpellAction_toIdle.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Irelia_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/Irelia_Death.TFT_Set13.anm` |
| SpellHero | `df9c2ccd` | Atomic | `TFT13_Irelia_SpellHero.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Irelia/Skins/Base/Animations/TFT13_Irelia_SpellHero.TFT_Set13.anm` |

## lux

cast：tft13_lux_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_lux/skins/skin0.bin`；SHA-256：`c2548b925560b8e61a79c5eda06d5013e21d21b7fa0d981e0fb70f005940a96b`
- 源：`data/characters/tft13_lux/skins/root.bin`；SHA-256：`7c296ef9e2013caf0fbdfedf09514d5d4753b6669184c5cdbbb8a812551ce676`
- 源：`characters/tft13_lux`；SHA-256：`64b8362bc20193e17cdbee3464f6e0a857f2d16614d0f62f16042643d3de7af2`
- 源：`data/characters/tft13_lux/animations/skin0.bin`；SHA-256：`f5485c206c63e0bd3625da1d80c4d0ad7f990e17abff415d2f6454c66ff7d67b`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Lux_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/TFT13_Lux_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Lux_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/TFT13_Lux_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Lux_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/TFT13_Lux_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `lux_Skin15_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/lux_Skin15_death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `lux_skin15_run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/lux_skin15_run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Lux_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/TFT13_Lux_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `lux_Skin15_taunt.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/lux_Skin15_taunt.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Lux_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/TFT13_Lux_Spell.TFT_Set13.anm` |
| Spell_In | `0ec457ed` | Atomic | `TFT13_Lux_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/TFT13_Lux_Spell.TFT_Set13.anm` |
| Spell_Loop | `667e3c00` | Atomic | `TFT13_Lux_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/TFT13_Lux_Spell.TFT_Set13.anm` |
| Spell_Out | `a2edf5d6` | Atomic | `TFT13_Lux_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/TFT13_Lux_Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `lux_Skin15_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lux/Skins/Base/Animations/lux_Skin15_death.TFT_Set13.anm` |

## maddie

cast：spell1；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_shooter/skins/skin0.bin`；SHA-256：`302701bec95700c5159ceb37397870337edf5eed87ed6feca43ea7d137a34cef`
- 源：`data/characters/tft13_shooter/skins/root.bin`；SHA-256：`84e3bbdc318dc9213efbd61d60f45f0d2c95b195d92e194d26ec53a3974ac002`
- 源：`characters/tft13_shooter`；SHA-256：`e443f674ec3c3f089e7e05c94462282075240242655fec247f75c931ff25ae54`
- 源：`data/characters/tft13_shooter/animations/skin0.bin`；SHA-256：`bc994d383f3b83c56f7c712e8f166297605e131df62b6df7cc3d9d24691412fa`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Auto1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Shooter/Skins/Base/Animations/Auto1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Auto2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Shooter/Skins/Base/Animations/Auto2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Shooter/Skins/Base/Animations/death1.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Locomotion1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Shooter/Skins/Base/Animations/Locomotion1.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Shooter/Skins/Base/Animations/Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `589c6ca2` | Atomic | `Celebration1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Shooter/Skins/Base/Animations/Celebration1.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Spell1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Shooter/Skins/Base/Animations/Spell1.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Shooter/Skins/Base/Animations/death1.TFT_Set13.anm` |

## morgana

cast：tft13_morgana_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_morgana/skins/skin0.bin`；SHA-256：`88971cba31096b66e63605206351070631fbdea248be46f37e16905b5a610f7a`
- 源：`data/characters/tft13_morgana/skins/root.bin`；SHA-256：`74594b63f6bbad9216409639938065b234a151d31b41107eca2edd20f2532753`
- 源：`characters/tft13_morgana`；SHA-256：`00558eb223f6634a3ca4a39dc8a968c3df7779daa3290e7d04ed5aa37e412f33`
- 源：`data/characters/tft13_morgana/animations/skin0.bin`；SHA-256：`7469b8ad4f52d3b1a7e949bc6e954155e4364a2705b4bb7bb3673c6babeebb90`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Morgana_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Morgana/Skins/Base/Animations/TFT13_Morgana_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Morgana_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Morgana/Skins/Base/Animations/TFT13_Morgana_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Morgana_Skin26_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Morgana/Skins/Base/Animations/Morgana_Skin26_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Morgana_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Morgana/Skins/Base/Animations/TFT13_Morgana_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Morgana_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Morgana/Skins/Base/Animations/TFT13_Morgana_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Morgana_Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Morgana/Skins/Base/Animations/TFT13_Morgana_Celebration.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Morgana_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Morgana/Skins/Base/Animations/TFT13_Morgana_Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Morgana_Skin26_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Morgana/Skins/Base/Animations/Morgana_Skin26_Death.TFT_Set13.anm` |
| Spell_Out | `a2edf5d6` | Atomic | `TFT13_Morgana_Spell_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Morgana/Skins/Base/Animations/TFT13_Morgana_Spell_Out.TFT_Set13.anm` |

## powder

cast：spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_blue/skins/skin0.bin`；SHA-256：`0bcbf25341fa33f845e129009a1eeabcbbc202fa3d16f5bbd83c605591530308`
- 源：`data/characters/tft13_blue/skins/root.bin`；SHA-256：`4e2bb9c2922609d995d733c1d3f78ccaa0e08ea7d3ae953036af95572b98b526`
- 源：`characters/tft13_blue`；SHA-256：`6dd4a1e884af616951619f73f8f6fc595759c78c15d58516a5a70e1b69cb9747`
- 源：`data/characters/tft13_blue/animations/skin0.bin`；SHA-256：`5cc1675cde1c5c56b02a81cd7d70ef14920ef404f15bb72566081173555512fd`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `attack_1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blue/Skins/Base/Animations/attack_1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `attack_2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blue/Skins/Base/Animations/attack_2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blue/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blue/Skins/Base/Animations/Run.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Spell | `a96fc6c9` | Atomic | `Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blue/Skins/Base/Animations/Spell.TFT_Set13.anm` |
| Crit | `9654058d` | 非 Atomic 0x49f4b8ca | 无直接 ANM | — |
| Idle1 | `9dd9dc06` | Atomic | `Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blue/Skins/Base/Animations/Idle.TFT_Set13.anm` |
| celebration_start | `c374007c` | Atomic | `Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blue/Skins/Base/Animations/Celebration.TFT_Set13.anm` |
| Celebration_Loop | `9184e67e` | Atomic | `Celebration_Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blue/Skins/Base/Animations/Celebration_Idle.TFT_Set13.anm` |
| death_loop | `36fa7cec` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blue/Skins/Base/Animations/Death.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blue/Skins/Base/Animations/Death.TFT_Set13.anm` |

## singed（原缺 cast）

cast：tft13_singed_spell_3；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_singed/skins/skin0.bin`；SHA-256：`99f9f6a3c30de73b4b464f10a9bc6759d504ba11773f44f27ec3ea6d3c9bafb7`
- 源：`data/characters/tft13_singed/skins/root.bin`；SHA-256：`0c51bc8b172013c898bab388c76308f043fc114bb5b979afa80c95d7067beb2f`
- 源：`characters/tft13_singed`；SHA-256：`d647d1aa93a7a4984fa674a41be950183838bf2824278b35f9c38df10c2eaa96`
- 源：`data/characters/tft13_singed/animations/skin0.bin`；SHA-256：`35daef0a3102f8993a75c5ac4b0d3cd954a780e51cc70b331082588c79bcf0ff`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Singed_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/TFT13_Singed_attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Singed_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/TFT13_Singed_attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Singed_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/Singed_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Singed_run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/TFT13_Singed_run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Singed_idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/TFT13_Singed_idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Singed_Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/TFT13_Singed_Celebration.TFT_Set13.anm` |
| 未知 | `85a7d7e9` | Atomic | `TFT13_Singed_Spell_3.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/TFT13_Singed_Spell_3.TFT_Set13.anm` |
| 未知 | `1bab12f3` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Spell_2 | `82a7d330` | Atomic | `TFT13_Singed_Spell_3.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/TFT13_Singed_Spell_3.TFT_Set13.anm` |
| Spell_Out | `a2edf5d6` | Atomic | `TFT13_Singed_Spell_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/TFT13_Singed_Spell_Out.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Singed_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/Singed_Death.TFT_Set13.anm` |
| 未知 | `1ddf7812` | Atomic | `TFT13_Singed_Spell_3.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/TFT13_Singed_Spell_3.TFT_Set13.anm` |
| 未知 | `caec9920` | 非 Atomic 0x2160b3ec | 无直接 ANM | — |
| Spell_Run | `007ddf23` | Atomic | `TFT13_Singed_run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Singed/Skins/Base/Animations/TFT13_Singed_run.TFT_Set13.anm` |

## steb

cast：spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_fish/skins/skin0.bin`；SHA-256：`9ff18d3cd04b0e8de31dda3e1807c9dadf425f2807e039aa0e4f8cc26a67c634`
- 源：`data/characters/tft13_fish/skins/root.bin`；SHA-256：`3c626dc4b214537c9ed9dc58baf0cac67aa42893156d786f1fc67cf1df53f38c`
- 源：`characters/tft13_fish`；SHA-256：`59b6590b7b611825c23815a9acc5a1438fd8c0bfe143a6acc24d758ede39a5b5`
- 源：`data/characters/tft13_fish/animations/skin0.bin`；SHA-256：`12a0dd28de0fb6a5f19840f76bbfa18483f41defca82af03303805b0df470ee3`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/Idle.TFT_Set13.anm` |
| Celebration_In | `5e3de03f` | Atomic | `Celebration_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/Celebration_In.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/Spell.TFT_Set13.anm` |
| Spell_Attack | `121e3dee` | Atomic | `Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/Spell.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Celebration_Loop | `9184e67e` | Atomic | `Celebration_loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/Celebration_loop.TFT_Set13.anm` |
| 未知 | `f3d41c20` | Atomic | `Celebration_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/Celebration_In.TFT_Set13.anm` |
| Crit | `9654058d` | 非 Atomic 0x49f4b8ca | 无直接 ANM | — |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Fish/Skins/Base/Animations/Death.TFT_Set13.anm` |

## trundle

cast：bite；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_trundle/skins/skin0.bin`；SHA-256：`e937e6a637b6e8aab9fadf7ed07662eaf9a169227777b14b90a8369200564816`
- 源：`data/characters/tft13_trundle/skins/root.bin`；SHA-256：`fca878839a3d8ec2c98fdccd2324e2d0c562b817eeac0186f49565a0395d0634`
- 源：`characters/tft13_trundle`；SHA-256：`907b7944c1a0063adda0885ef62886bcc3374f11bfe5dbbf18bd03022f264b26`
- 源：`data/characters/tft13_trundle/animations/skin0.bin`；SHA-256：`56ca798f80bc82d7b733ba6828bcb044b6809b41f365799761bc67fe0406ed09`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Trundle/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack3.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Trundle/Skins/Base/Animations/Attack3.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Trundle/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Trundle_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Trundle/Skins/Base/Animations/TFT13_Trundle_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Trundle/Skins/Base/Animations/Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Trundle/Skins/Base/Animations/Dance.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Bite.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Trundle/Skins/Base/Animations/Bite.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Trundle/Skins/Base/Animations/Death.TFT_Set13.anm` |
| SpellHeal | `de7bd78f` | Atomic | `TFT13_Trundle_SpellHeal.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Trundle/Skins/Base/Animations/TFT13_Trundle_SpellHeal.TFT_Set13.anm` |

## vex

cast：tft13_vex_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_vex/skins/skin0.bin`；SHA-256：`272a47f64ad19d194421945b9b9f455d47cdd2fb7d20f10cf8ac20e1be243751`
- 源：`data/characters/tft13_vex/skins/root.bin`；SHA-256：`cd9c18b69c1a9f68e6c8eb8619236bb89d32f7131faff3271704f0810fc34dc7`
- 源：`characters/tft13_vex`；SHA-256：`8cbc65d258f45d7caf75a8fe3d18d723c1559ebad5f5bd9b503f9b67729f753c`
- 源：`data/characters/tft13_vex/animations/skin0.bin`；SHA-256：`80603372f99feeb21db7e1bd9aeac6e9950b4ae0ef045018aa7865ac918ee8a2`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Vex_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/TFT13_Vex_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle_new.TFT_Set13_Evolved.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/Idle_new.TFT_Set13_Evolved.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Vex_Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/TFT13_Vex_Celebration.TFT_Set13.anm` |
| Attack1_In | `0342d882` | Atomic | `TFT13_Vex_Attack1_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/TFT13_Vex_Attack1_In.TFT_Set13.anm` |
| Attack1_Hit | `8471da16` | Atomic | `TFT13_Vex_Attack1_Hit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/TFT13_Vex_Attack1_Hit.TFT_Set13.anm` |
| Attack1_Out | `b3dc4d1b` | Atomic | `TFT13_Vex_Attack1_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/TFT13_Vex_Attack1_Out.TFT_Set13.anm` |
| Attack1 | `56b1e924` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Attack2_In | `7b63d3c9` | Atomic | `TFT13_Vex_Attack2_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/TFT13_Vex_Attack2_In.TFT_Set13.anm` |
| Attack2_Hit | `8e47a597` | Atomic | `TFT13_Vex_Attack2_Hit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/TFT13_Vex_Attack2_Hit.TFT_Set13.anm` |
| Attack2_Out | `6f6794ca` | Atomic | `TFT13_Vex_Attack2_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/TFT13_Vex_Attack2_Out.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Spell | `a96fc6c9` | Atomic | `TFT13_Vex_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/TFT13_Vex_Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vex/Skins/Base/Animations/Death.TFT_Set13.anm` |

## violet

cast：spell1；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_red/skins/skin0.bin`；SHA-256：`4620eb2d3f1161bdf39d444dc20e3b4fabee78f3b24243c54257fef3b80f4041`
- 源：`data/characters/tft13_red/skins/root.bin`；SHA-256：`480c91a1c805e346ecb6cf422a1d248678f093bd37d34adcfaa8dd8026e33b75`
- 源：`characters/tft13_red`；SHA-256：`b0fc3f381adaa825316b66c3584d50be2d304b4571c3ba1e1cbd3af29dc9285c`
- 源：`data/characters/tft13_red/animations/skin0.bin`；SHA-256：`c9aa4667f963f50a3c3d757071929cc950569f62ab6f88b8ba288498bd3a1261`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Red/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Red/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Red/Skins/Base/Animations/Death1.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Red/Skins/Base/Animations/Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle3_New.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Red/Skins/Base/Animations/Idle3_New.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Dance_Loop | `1fcb6757` | Atomic | `Celebration1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Red/Skins/Base/Animations/Celebration1.TFT_Set13.anm` |
| Spell1 | `b2f63868` | Atomic | `Spell1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Red/Skins/Base/Animations/Spell1.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Red/Skins/Base/Animations/Death1.TFT_Set13.anm` |

## zyra

cast：spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_zyra/skins/skin0.bin`；SHA-256：`b4a50a19d460785f7d3ac7ae5bcdfe7ca6f876d28ce1c22b968c717002a87436`
- 源：`data/characters/tft13_zyra/skins/root.bin`；SHA-256：`4f530d5eab59e164b4ecc8761a592e06de37694e32e0056a5ba57ef32566d59f`
- 源：`characters/tft13_zyra`；SHA-256：`9fb5274bea4e6d69efd9057aa9523d258cb94c5ba245c846ff34147ff6543b97`
- 源：`data/characters/tft13_zyra/animations/skin0.bin`；SHA-256：`1eb271276a5bfe163fe4d0aaf453df70c15ebcac89186b63bfc887b0521faac8`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zyra/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zyra/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zyra/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zyra/Skins/Base/Animations/Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zyra/Skins/Base/Animations/Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zyra/Skins/Base/Animations/Dance.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zyra/Skins/Base/Animations/Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zyra/Skins/Base/Animations/Death.TFT_Set13.anm` |

## akali

cast：tft13_akali_spell1；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_akali/skins/skin0.bin`；SHA-256：`691de8c9988269fd69d9987ef4ed0c2a3731cdf80032a2ea1cef4b4b24e70d22`
- 源：`data/characters/tft13_akali/skins/root.bin`；SHA-256：`f43420c15b4bf58bc60422ef48ec39e1d20dcb10d78e76135a5603d29e70c86a`
- 源：`characters/tft13_akali`；SHA-256：`ff480f74140a85f0cba47a425b6d878ddfe0186ae4f3dc060e68874e4bf4de8a`
- 源：`data/characters/tft13_akali/animations/skin0.bin`；SHA-256：`c9148dce94bc49e4e6d58d711189f825dbe8d0064278323d40ed23d253545edb`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Akali_Base_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/TFT13_Akali_Base_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Akali_Base_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/TFT13_Akali_Base_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Akali_Base_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/TFT13_Akali_Base_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Akali_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/TFT13_Akali_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Akali_Base_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/TFT13_Akali_Base_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Akali_Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/TFT13_Akali_Celebration.TFT_Set13.anm` |
| Spell1 | `b2f63868` | Atomic | `TFT13_Akali_Spell1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/TFT13_Akali_Spell1.TFT_Set13.anm` |
| Spell2_Out | `95f9046e` | Atomic | `TFT13_Akali_Spell2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/TFT13_Akali_Spell2.TFT_Set13.anm` |
| Spell3_In | `a8bba110` | Atomic | `TFT13_Akali_Spell3_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/TFT13_Akali_Spell3_In.TFT_Set13.anm` |
| Spell3_Out | `e4ab98b5` | Atomic | `TFT13_Akali_Spell3_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/TFT13_Akali_Spell3_Out.TFT_Set13.anm` |
| Spell2 | `b5f63d21` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Spell3 | `b4f63b8e` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Akali/Skins/Base/Animations/Death.TFT_Set13.anm` |

## camille

cast：tft13_camille_spell1；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_camille/skins/skin0.bin`；SHA-256：`89ddbf373b3fc9d1ba954f8180d7ea0fd6713043a29ea61ea41453a1420d62c6`
- 源：`data/characters/tft13_camille/skins/root.bin`；SHA-256：`c1a799bec7f0f3b2023688038b3e99776db1a953fb4269c063fba8015384a313`
- 源：`characters/tft13_camille`；SHA-256：`b4e05b6497ad1d643f5f226080d185eab87208090c30a38048e3dbdc6b822e13`
- 源：`data/characters/tft13_camille/animations/skin0.bin`；SHA-256：`541a36968ff886875894f4b7d57e9d0a42499534b83ea1872cf78df24cc28111`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Camille_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/TFT13_Camille_Attack1.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Camille_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/TFT13_Camille_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Camille_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/Camille_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Camille_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/TFT13_Camille_Run.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Camille_Idle_loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/TFT13_Camille_Idle_loop.TFT_Set13.anm` |
| Dance_Loop | `1fcb6757` | Atomic | `TFT13_Camille_Dance_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/TFT13_Camille_Dance_Loop.TFT_Set13.anm` |
| Spell1 | `b2f63868` | Atomic | `TFT13_Camille_Spell1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/TFT13_Camille_Spell1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Camille_Attack_2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/TFT13_Camille_Attack_2.TFT_Set13.anm` |
| Spell1_Out | `87b671cf` | Atomic | `TFT13_Camille_Spell1_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/TFT13_Camille_Spell1_Out.TFT_Set13.anm` |
| Spell | `a96fc6c9` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `b112eba6` | Atomic | `TFT13_Camille_Spell1_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/TFT13_Camille_Spell1_Out.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Camille_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Camille/Skins/Base/Animations/Camille_Death.TFT_Set13.anm` |

## leona（原缺 cast）

cast：tft13_leona_spell_in；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_leona/skins/skin0.bin`；SHA-256：`3c9378fb1d1660e1fd3da0f6c8113fbca7ca5cf338e099697700be73f73232fb`
- 源：`data/characters/tft13_leona/skins/root.bin`；SHA-256：`fe5bc9a7f42da927b7cfd630b4e864c3dce3bb001755fc4933cfc74edb3ac29a`
- 源：`characters/tft13_leona`；SHA-256：`aba564888ffac09df6a772ae49169d08c702887cc15154a3d4d000f63413ca05`
- 源：`data/characters/tft13_leona/animations/skin0.bin`；SHA-256：`02d51e7990cf3ec75a420c445422bf489e123df3928668e1a1280de3a2296a9b`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Leona_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/TFT13_Leona_attack1.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `leona_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/leona_death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Leona_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/TFT13_Leona_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Leona_idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/TFT13_Leona_idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `leona_dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/leona_dance.TFT_Set13.anm` |
| Spell_In | `0ec457ed` | Atomic | `TFT13_Leona_Spell_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/TFT13_Leona_Spell_In.TFT_Set13.anm` |
| Spell_Idle | `a476ff14` | Atomic | `TFT13_Leona_Spell_Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/TFT13_Leona_Spell_Idle.TFT_Set13.anm` |
| Spell_Run | `007ddf23` | Atomic | `TFT13_Leona_Spell_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/TFT13_Leona_Spell_Run.TFT_Set13.anm` |
| Spell_Out | `a2edf5d6` | Atomic | `TFT13_Leona_Spell_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/TFT13_Leona_Spell_In.TFT_Set13.anm` |
| Spell_Damage | `b15bb66f` | Atomic | `TFT13_Leona_Spell_Damage.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/TFT13_Leona_Spell_Damage.TFT_Set13.anm` |
| Spell_Attack | `121e3dee` | Atomic | `TFT13_Leona_Spell_Attack.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/TFT13_Leona_Spell_Attack.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `leona_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Leona/Skins/Base/Animations/leona_death.TFT_Set13.anm` |

## nocturne

cast：tft13_nocturne_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_nocturne/skins/skin0.bin`；SHA-256：`599a108db06be76faa67c2a71710eee50783a7cd3446b149306faf3a3ed17ba8`
- 源：`data/characters/tft13_nocturne/skins/root.bin`；SHA-256：`3464087265b0b4b77e98d5068bad13009a541a668d4ecd252cd15e529130779a`
- 源：`characters/tft13_nocturne`；SHA-256：`4e9c2bd865b013e76ea83e4c638716b4a0889ee171154ed968eef486e611be8f`
- 源：`data/characters/tft13_nocturne/animations/skin0.bin`；SHA-256：`802a56e26f3ddbd65251f12824448924b12e1290d30252456e0a198fbfcb27b4`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Nocturne_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Nocturne_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Nocturne_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `TFT13_Nocturne_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Nocturne_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Nocturne_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Nocturne_Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_Celebration.TFT_Set13.anm` |
| PassiveAttack | `d8c9e2da` | Atomic | `TFT13_Nocturne_PassiveAttack.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_PassiveAttack.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Nocturne_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_Spell.TFT_Set13.anm` |
| death_loop | `36fa7cec` | Atomic | `TFT13_Nocturne_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_Death.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `TFT13_Nocturne_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nocturne/Skins/Base/Animations/TFT13_Nocturne_Death.TFT_Set13.anm` |

## rell（原缺 cast）

cast：tft13_rell_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_rell/skins/skin0.bin`；SHA-256：`b8b7ee688443c25da6b91386fd3e7034b9355b6117e318a274665f4f85a1785a`
- 源：`data/characters/tft13_rell/skins/root.bin`；SHA-256：`96c91f90d39edc804b0c4915e683bf1fbf9f281cd58784c243c99c2b462c9609`
- 源：`characters/tft13_rell`；SHA-256：`7ad19540e6335a2088d0605d19c559806922f5becd0ae7efb2b987e58279af62`
- 源：`data/characters/tft13_rell/animations/skin0.bin`；SHA-256：`234ccb58868738cd3e5a7e305e2d697128163c2cda25b45e469e0c38a0949f9c`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Auto_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/Auto_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Auto_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/Auto_Attack1.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `Auto_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/Auto_Attack1.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Rell_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/TFT13_Rell_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Rell_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/TFT13_Rell_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Rell_Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/TFT13_Rell_Celebration.TFT_Set13.anm` |
| Spell_In | `0ec457ed` | Atomic | `TFT13_Rell_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/TFT13_Rell_Spell.TFT_Set13.anm` |
| Spell_Out | `a2edf5d6` | Atomic | `TFT13_Rell_Spell_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/TFT13_Rell_Spell_Out.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/Death.TFT_Set13.anm` |
| death_loop | `36fa7cec` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rell/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Spell | `a96fc6c9` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |

## renata

cast：tft13_renataglasc_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_renataglasc/skins/skin0.bin`；SHA-256：`f74c5648684128b6efc0b9a14516320a7e9162fcdcadec89a4a76f4af55915cf`
- 源：`data/characters/tft13_renataglasc/skins/root.bin`；SHA-256：`d6297c8fa953812edb14253664b9463b2e2c544edb1315ba9f231c1682b89570`
- 源：`characters/tft13_renataglasc`；SHA-256：`1e847cf52af53bd377742312041dc2ac0fd549206ff07d32345971a45780c1a0`
- 源：`data/characters/tft13_renataglasc/animations/skin0.bin`；SHA-256：`48b177a872af102268448f587ce1cbdf1a517e8caed1270b1e8f44f46b57fffe`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1_New.TFT_Set13.anm` | `ASSETS/Characters/TFT13_RenataGlasc/Skins/Base/Animations/Attack1_New.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack1_New.TFT_Set13.anm` | `ASSETS/Characters/TFT13_RenataGlasc/Skins/Base/Animations/Attack1_New.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death_RenataGlasc.TFT_Set13.anm` | `ASSETS/Characters/TFT13_RenataGlasc/Skins/Base/Animations/Death_RenataGlasc.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_RenataGlasc/Skins/Base/Animations/Run_new.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_RenataGlasc/Skins/Base/Animations/idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Dance_Cycle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_RenataGlasc/Skins/Base/Animations/Dance_Cycle.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_RenataGlasc_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_RenataGlasc/Skins/Base/Animations/TFT13_RenataGlasc_Spell.TFT_Set13.anm` |
| Spell_ToIdle | `c4c6dac5` | Atomic | `TFT13_RenataGlasc_Spell_toIdle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_RenataGlasc/Skins/Base/Animations/TFT13_RenataGlasc_Spell_toIdle.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death_RenataGlasc.TFT_Set13.anm` | `ASSETS/Characters/TFT13_RenataGlasc/Skins/Base/Animations/Death_RenataGlasc.TFT_Set13.anm` |
| death_loop | `36fa7cec` | Atomic | `Death_RenataGlasc.TFT_Set13.anm` | `ASSETS/Characters/TFT13_RenataGlasc/Skins/Base/Animations/Death_RenataGlasc.TFT_Set13.anm` |

## sett（原缺 cast）

cast：tft13_sett_spell3；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_sett/skins/skin0.bin`；SHA-256：`7e5f2bfa76f6a8eb14ce6389635e73ad9ed5eae3c9c11edbd54203323d24bd63`
- 源：`data/characters/tft13_sett/skins/root.bin`；SHA-256：`04c3bd3f7c7d6b45e0bed4d67a83ad3d613646f57d744095b7112a17a1cb3742`
- 源：`characters/tft13_sett`；SHA-256：`0614ccb1d13735b9fe55801fad0b5c0892309ac6e565b35fe29c1cb222d8c28b`
- 源：`data/characters/tft13_sett/animations/skin0.bin`；SHA-256：`673ba24de4f4fea2e1cefb9533d17bf3845ffb4e02d3c1a07b1e770b06b696b5`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Attack2 | `59b1eddd` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Death | `bd28bd4d` | Atomic | `TFT13_Sett_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Sett_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Sett_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Idle1.TFT_Set13.anm` |
| Attack1_Start | `c19f4bd3` | Atomic | `TFT13_Sett_Attack1_Start.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Attack1_Start.TFT_Set13.anm` |
| Attack1_Hit | `8471da16` | Atomic | `Sett_Attack_New.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/Sett_Attack_New.TFT_Set13.anm` |
| Attack2_Start | `17538da6` | Atomic | `TFT13_Sett_Attack2_Start.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Attack2_Start.TFT_Set13.anm` |
| Attack2_Hit | `8e47a597` | Atomic | `TFT13_Sett_Attack2_Hit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Attack2_Hit.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Sett_Dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Dance.TFT_Set13.anm` |
| Attack1_Out | `b3dc4d1b` | Atomic | `Sett_Attack_New.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/Sett_Attack_New.TFT_Set13.anm` |
| Attack2_Out | `6f6794ca` | Atomic | `TFT13_Sett_Attack2_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Attack2_Out.TFT_Set13.anm` |
| Spell3 | `b4f63b8e` | Atomic | `TFT13_Sett_Spell3.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Spell3.TFT_Set13.anm` |
| Spell3_Back_End | `5c442f6e` | Atomic | `TFT13_Sett_Spell3_Back_End.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Spell3_Back_End.TFT_Set13.anm` |
| Spell3_Back_Start | `2d05b7ab` | Atomic | `TFT13_Sett_Spell3_Back_Start.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Spell3_Back_Start.TFT_Set13.anm` |
| Spell3_Both_End | `2ed2622a` | Atomic | `TFT13_Sett_Spell3_Both_End.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Spell3_Both_End.TFT_Set13.anm` |
| Spell3_Both_Start | `1cbc055f` | Atomic | `TFT13_Sett_Spell3_Both_Start.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Spell3_Both_Start.TFT_Set13.anm` |
| Spell3_Front_End | `52caffa4` | Atomic | `TFT13_Sett_Spell3_Front_End.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Spell3_Front_End.TFT_Set13.anm` |
| Spell3_Front_Start | `3973f77d` | Atomic | `TFT13_Sett_Spell3_Front_Start.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Spell3_Front_Start.TFT_Set13.anm` |
| 未知 | `8b97f38c` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `c02dfe98` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `f8002852` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| knockup | `297cd14a` | Atomic | `TFT13_Sett_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Sett/Skins/Base/Animations/TFT13_Sett_Death.TFT_Set13.anm` |

## tristana（原缺 cast）

cast：tft13_tristana_spell_start；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_tristana/skins/skin0.bin`；SHA-256：`68262572b78f66ed3dba5a053e765b8f8ee3de69ffc963bcb6935ebd88f42f54`
- 源：`data/characters/tft13_tristana/skins/root.bin`；SHA-256：`01092848d00dade0fb62bd5a891a7714133b60cd1d4a8bbf3b74a5812d13ebdf`
- 源：`characters/tft13_tristana`；SHA-256：`8bc37c1e2fabb559f69dca745acb4360692eb65e9389f32cc7dc778fdd67ec05`
- 源：`data/characters/tft13_tristana/animations/skin0.bin`；SHA-256：`527aaeda5616666daa2924441c91b7dce45b50b66fc0697f4c6e161c5daa7526`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Tristana_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Tristana/Skins/Base/Animations/TFT13_Tristana_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Tristana_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Tristana/Skins/Base/Animations/TFT13_Tristana_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Tristana_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Tristana/Skins/Base/Animations/TFT13_Tristana_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `TFT13_Tristana_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Tristana/Skins/Base/Animations/TFT13_Tristana_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Tristana_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Tristana/Skins/Base/Animations/TFT13_Tristana_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Tristana_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Tristana/Skins/Base/Animations/TFT13_Tristana_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Tristana_Dance_LOOP_Raw.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Tristana/Skins/Base/Animations/TFT13_Tristana_Dance_LOOP_Raw.TFT_Set13.anm` |
| Spell_Start | `4eb40f3a` | Atomic | `TFT13_Tristana_Spell_Start.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Tristana/Skins/Base/Animations/TFT13_Tristana_Spell_Start.TFT_Set13.anm` |
| Spell_Attack | `121e3dee` | Atomic | `TFT13_Tristana_Spell_Attack.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Tristana/Skins/Base/Animations/TFT13_Tristana_Spell_Attack.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `TFT13_Tristana_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Tristana/Skins/Base/Animations/TFT13_Tristana_Death.TFT_Set13.anm` |

## urgot

cast：tft13_urgot_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_urgot/skins/skin0.bin`；SHA-256：`e3b89f2d317c9556c5c84dde8264c31e9dd5efc5c189a90acd64b9c4a4bf6baf`
- 源：`data/characters/tft13_urgot/skins/root.bin`；SHA-256：`02d81037b86c79d3dfd660ae9833bd03b59069fcf035ad885b163b240698ceb8`
- 源：`characters/tft13_urgot`；SHA-256：`ee19b9983df2c2001edc593de9646a10a63cc477cc0aa6670f71ad4b8c790719`
- 源：`data/characters/tft13_urgot/animations/skin0.bin`；SHA-256：`73c800bef210134928aefd6f930cd08fa551623051a345c76b9ba929d7cc52fe`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Urgot_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Urgot/Skins/Base/Animations/TFT13_Urgot_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Urgot_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Urgot/Skins/Base/Animations/TFT13_Urgot_Attack1.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Urgot_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Urgot/Skins/Base/Animations/TFT13_Urgot_Attack1.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Urgot/Skins/Base/Animations/Death_new.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Urgot_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Urgot/Skins/Base/Animations/TFT13_Urgot_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Urgot_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Urgot/Skins/Base/Animations/TFT13_Urgot_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Dance_Loop | `1fcb6757` | Atomic | `TFT13_Urgot_Dance_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Urgot/Skins/Base/Animations/TFT13_Urgot_Dance_Loop.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Urgot_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Urgot/Skins/Base/Animations/TFT13_Urgot_Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Urgot/Skins/Base/Animations/Death_new.TFT_Set13.anm` |

## vander（原缺 cast）

cast：spell_brace；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_prime/skins/skin0.bin`；SHA-256：`3d28305ff70e0414f088625600e58ef0fc343cb2bb1d2c774580114967605488`
- 源：`data/characters/tft13_prime/skins/root.bin`；SHA-256：`072f84e0be3a787374a816141cf0ef4164a7b0ca266d93b7a9f0ef6f168dbdde`
- 源：`characters/tft13_prime`；SHA-256：`e1966df6c9704170b99d6f0b066c1b1e1374086563ce82405ecb223e6f527dba`
- 源：`data/characters/tft13_prime/animations/skin0.bin`；SHA-256：`4f59f13e59e8c938fc01d85293da76d418d9890e691479f9a5488c27f25de5e7`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack2 | `59b1eddd` | Atomic | `attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/attack2.TFT_Set13.anm` |
| Attack1 | `56b1e924` | Atomic | `attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/attack1.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run_New.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/Run_New.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle1_Final.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/Idle1_Final.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `RegularDance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/RegularDance.TFT_Set13.anm` |
| Spell_Brace | `4921c1c5` | Atomic | `Spell_Brace.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/Spell_Brace.TFT_Set13.anm` |
| attack1_end | `55c93006` | Atomic | `attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/attack1.TFT_Set13.anm` |
| attack2_end | `dfcb6303` | Atomic | `attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/attack2.TFT_Set13.anm` |
| Spell_Brace_Loop | `e4bebcf4` | Atomic | `Spell_Brace_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/Spell_Brace_Loop.TFT_Set13.anm` |
| 未知 | `b32cd1be` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `1fbcb25a` | Atomic | `Spell_Strike_End_2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/Spell_Strike_End_2.TFT_Set13.anm` |
| 未知 | `459718cf` | Atomic | `Spell_Strike_Start_2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/Spell_Strike_Start_2.TFT_Set13.anm` |
| Spell | `a96fc6c9` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| attack1_loop | `80c6a1cf` | Atomic | `attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/attack1.TFT_Set13.anm` |
| 未知 | `0b59cad6` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| attack2_loop | `2afa66dc` | Atomic | `attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/attack2.TFT_Set13.anm` |
| 未知 | `8f8791fd` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| death_loop | `36fa7cec` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Prime/Skins/Base/Animations/Death.TFT_Set13.anm` |

## vladimir

cast：spell1；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_vladimir/skins/skin0.bin`；SHA-256：`a4edaf58dbf47e8732bac071dee3ff8b11934a101e42b1b2e82ec7b188f9d0ab`
- 源：`data/characters/tft13_vladimir/skins/root.bin`；SHA-256：`d77959f1748f0b85871cdd55854f14d17f63c2bcafafd4599d669f2ceac5516f`
- 源：`characters/tft13_vladimir`；SHA-256：`8ff001bcfe840e0cf345ae49c0a424fac2b83aa8990ca576b8b4b1ea6da89fe3`
- 源：`data/characters/tft13_vladimir/animations/skin0.bin`；SHA-256：`bf790aa859ad1ed3181100d368569d51283d0d46427b4d5c6ff9bc4c56153687`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vladimir/Skins/Base/Animations/attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vladimir/Skins/Base/Animations/attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `death_anim.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vladimir/Skins/Base/Animations/death_anim.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vladimir/Skins/Base/Animations/run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vladimir/Skins/Base/Animations/idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `dance_loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vladimir/Skins/Base/Animations/dance_loop.TFT_Set13.anm` |
| 未知 | `362e4fca` | Atomic | `spell1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vladimir/Skins/Base/Animations/spell1.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `death_anim.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vladimir/Skins/Base/Animations/death_anim.TFT_Set13.anm` |

## zeri（原缺 cast）

cast：tft13_zeri_spell1_in；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_zeri/skins/skin0.bin`；SHA-256：`845687395728d8a2fa5289caf3450797a94423181d6d5e4dfa9ae20cd0023153`
- 源：`data/characters/tft13_zeri/skins/root.bin`；SHA-256：`ae686a2acc0a43ca19728e622ed5d4c391e77d711cd28bd0fd5c5e490308a1de`
- 源：`characters/tft13_zeri`；SHA-256：`5e7c6f55b9b8dc411cf4daaaf2035f247b88e0bc3c8b3ec193a627aa0f5bc58d`
- 源：`data/characters/tft13_zeri/animations/skin0.bin`；SHA-256：`06e6f86360d702197c8ffc760a7f570e0548e39efb0cdb5815cbe9ce23e3af25`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1_In | `0342d882` | Atomic | `TFT13_Zeri_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/TFT13_Zeri_Attack1.TFT_Set13.anm` |
| Attack2_In | `7b63d3c9` | Atomic | `TFT13_Zeri_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/TFT13_Zeri_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Zeri_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/TFT13_Zeri_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Zeri_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/TFT13_Zeri_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Zeri_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/TFT13_Zeri_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Dance_Loop | `1fcb6757` | Atomic | `Dance_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/Dance_Loop.TFT_Set13.anm` |
| 未知 | `bb3e6721` | Atomic | `HoverboardPose1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/HoverboardPose1.TFT_Set13.anm` |
| Spell1_In | `dbda692e` | Atomic | `TFT13_Zeri_Spell1_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/TFT13_Zeri_Spell1_In.TFT_Set13.anm` |
| Spell1_Out | `87b671cf` | Atomic | `TFT13_Zeri_Spell1_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/TFT13_Zeri_Spell1_Out.TFT_Set13.anm` |
| Spell1 | `b2f63868` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Attack1_Out | `b3dc4d1b` | Atomic | `TFT13_Zeri_Attack1_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/TFT13_Zeri_Attack1_Out.TFT_Set13.anm` |
| Attack2_Out | `6f6794ca` | Atomic | `TFT13_Zeri_Attack1_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/TFT13_Zeri_Attack1_Out.TFT_Set13.anm` |
| Attack1 | `56b1e924` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Attack2 | `59b1eddd` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| HoverboardThrow | `b9f97c05` | Atomic | `HoverboardThrow1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/HoverboardThrow1.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zeri/Skins/Base/Animations/Death.TFT_Set13.anm` |

## ziggs

cast：spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_ziggs/skins/skin0.bin`；SHA-256：`b681af00cd061f1f703c9e1d165287f1e77b975cc02543523f552e9e18935762`
- 源：`data/characters/tft13_ziggs/skins/root.bin`；SHA-256：`51b080d6d0d229c53f0eb3b8a5c36ad2655462dbd1b60e7ddb0971b8f10b6b3c`
- 源：`characters/tft13_ziggs`；SHA-256：`e49f73c807aa9eeb69abe954bdfd7a8113c0fc281dc815d680f9d42c88d1c213`
- 源：`data/characters/tft13_ziggs/animations/skin0.bin`；SHA-256：`7c06952d6e6d8214f48cd93be54d8a58f10928c5ec1b3a40653f30d145c90306`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ziggs/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ziggs/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Ziggs_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ziggs/Skins/Base/Animations/Ziggs_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ziggs/Skins/Base/Animations/Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ziggs/Skins/Base/Animations/Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ziggs/Skins/Base/Animations/Dance.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ziggs/Skins/Base/Animations/Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Ziggs_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ziggs/Skins/Base/Animations/Ziggs_Death.TFT_Set13.anm` |

## blitzcrank

cast：tft13_blitzcrank_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_blitzcrank/skins/skin0.bin`；SHA-256：`a0531483a5b52d40c621e0f7be232115b3d32e98afa51fa452ddbba57b7a0500`
- 源：`data/characters/tft13_blitzcrank/skins/root.bin`；SHA-256：`2514febe7d975ae726e132270d197a6f60959441daf5d753216a45b04c097fad`
- 源：`characters/tft13_blitzcrank`；SHA-256：`e20952e7b1252f2a4a5b0dc3616655075b5928c711b81ddcd48b1415657ab0fb`
- 源：`data/characters/tft13_blitzcrank/animations/skin0.bin`；SHA-256：`0539f8a5bd30b4004b9da9a931e581c4b270d02e8d931e08ba8d9c0ce80ebaf5`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Blitzcrank_Skin20_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blitzcrank/Skins/Base/Animations/TFT13_Blitzcrank_Skin20_attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Blitzcrank_Skin20_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blitzcrank/Skins/Base/Animations/TFT13_Blitzcrank_Skin20_attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `TFT13_Blitzcrank_skin22_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blitzcrank/Skins/Base/Animations/TFT13_Blitzcrank_skin22_death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Blitzcrank_Skin22_run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blitzcrank/Skins/Base/Animations/TFT13_Blitzcrank_Skin22_run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Blitzcrank_Skin22_idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blitzcrank/Skins/Base/Animations/TFT13_Blitzcrank_Skin22_idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Blitzcrank_Skin22_dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blitzcrank/Skins/Base/Animations/TFT13_Blitzcrank_Skin22_dance.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Blitzcrank_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blitzcrank/Skins/Base/Animations/TFT13_Blitzcrank_Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `TFT13_Blitzcrank_skin22_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Blitzcrank/Skins/Base/Animations/TFT13_Blitzcrank_skin22_death.TFT_Set13.anm` |

## cassiopeia

cast：tft13_cassiopeia_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_cassiopeia/skins/skin0.bin`；SHA-256：`00ad54375cc6b412196d0d2411d723abfdeeea612a5ef137045787d9023ca3b0`
- 源：`data/characters/tft13_cassiopeia/skins/root.bin`；SHA-256：`9445a530b9a32d83174cd890d8de1905a61dfa38b55086a5bd3cf15820d82d01`
- 源：`characters/tft13_cassiopeia`；SHA-256：`beb3a42b7fc8a9cd8f403828d97fdc0c84963b6bf78a25cfb0d50f8ed4245cb7`
- 源：`data/characters/tft13_cassiopeia/animations/skin0.bin`；SHA-256：`7868959d0ce1e36c079dd8c72523922ac65bc86295f07927e6f74f209a8d20e5`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Cassiopeia_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Cassiopeia/Skins/Base/Animations/TFT13_Cassiopeia_attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Cassiopeia_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Cassiopeia/Skins/Base/Animations/TFT13_Cassiopeia_attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Cassiopeia_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Cassiopeia/Skins/Base/Animations/TFT13_Cassiopeia_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Cassiopeia/Skins/Base/Animations/Death_new.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Cassiopeia_run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Cassiopeia/Skins/Base/Animations/TFT13_Cassiopeia_run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Cassiopeia_idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Cassiopeia/Skins/Base/Animations/TFT13_Cassiopeia_idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Cassiopeia/Skins/Base/Animations/dance.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Cassiopeia_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Cassiopeia/Skins/Base/Animations/TFT13_Cassiopeia_Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Cassiopeia/Skins/Base/Animations/Death_new.TFT_Set13.anm` |

## ezreal（原缺 cast）

cast：tft13_ezreal_spell2_in；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_ezreal/skins/skin0.bin`；SHA-256：`b5a839fbb768640c424dceaeec8e8d540effa567dd05319086c97f8b5b4dc991`
- 源：`data/characters/tft13_ezreal/skins/root.bin`；SHA-256：`9be47c48dfc99ff725641d57aafcf85473e2333b784c5c763f63c04933dd83e1`
- 源：`characters/tft13_ezreal`；SHA-256：`3ad610785cbfeaedb078e99cdc9f29fae93f5db5bb27ef8f6c510b0a3e62a490`
- 源：`data/characters/tft13_ezreal/animations/skin0.bin`；SHA-256：`d0a6e5b681da05c63b9d5d2e1279738a9af11bde2c932bc9d8dd354dcc3f2b99`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Ezreal_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/TFT13_Ezreal_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Ezreal_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/TFT13_Ezreal_Attack2.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Ezreal_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/TFT13_Ezreal_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Ezreal_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/TFT13_Ezreal_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Ezreal_Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/TFT13_Ezreal_Celebration.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Ezreal_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/TFT13_Ezreal_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/Death1.TFT_Set13.anm` |
| Spell2_In | `52f64265` | Atomic | `TFT13_Ezreal_Spell2_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/TFT13_Ezreal_Spell2_In.TFT_Set13.anm` |
| Spell2_Out | `95f9046e` | Atomic | `TFT13_Ezreal_Spell2_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/TFT13_Ezreal_Spell2_Out.TFT_Set13.anm` |
| Spell3_In | `a8bba110` | Atomic | `TFT13_Ezreal_Spell3_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/TFT13_Ezreal_Spell3_In.TFT_Set13.anm` |
| Spell3_Out | `e4ab98b5` | Atomic | `TFT13_Ezreal_Spell3_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/TFT13_Ezreal_Spell3_Out.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ezreal/Skins/Base/Animations/Death1.TFT_Set13.anm` |

## gangplank（原缺 cast）

cast：无法判定 / ambiguous-action；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_gangplank/skins/skin0.bin`；SHA-256：`05b92053f0b9f5c41e3734b56db670343e4485666b873648f7c674c9702be0df`
- 源：`data/characters/tft13_gangplank/skins/root.bin`；SHA-256：`a51c099b94ddfb8db2cd8bce9899111c0ac10ca8cbfa909bdf412ea54abe8621`
- 源：`characters/tft13_gangplank`；SHA-256：`a47e068648cb5e0888f4fd06b19cd4bfd219b1fbbc41266bb3aa7f8b40423dbf`
- 源：`data/characters/tft13_gangplank/animations/skin0.bin`；SHA-256：`000bb8e7bf17ff350166d96b726f1499f4df0c1bb366c4801b08b574b85febaa`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Death | `bd28bd4d` | Atomic | `Gangplank_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/Gangplank_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Gangplank_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Run.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Gangplank_Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Celebration.TFT_Set13.anm` |
| Attack1_Melee | `8581b507` | Atomic | `TFT13_Gangplank_Attack1_Melee.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Attack1_Melee.TFT_Set13.anm` |
| Attack2_Melee | `321b80be` | Atomic | `TFT13_Gangplank_Attack2_Melee.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Attack2_Melee.TFT_Set13.anm` |
| Crit_Melee | `432c4b8e` | Atomic | `TFT13_Gangplank_Crit_Melee.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Crit_Melee.TFT_Set13.anm` |
| Attack1_Ranged | `93974bbe` | Atomic | `TFT13_Gangplank_Attack1_Ranged.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Attack1_Ranged.TFT_Set13.anm` |
| Spell_Melee | `a645486a` | Atomic | `TFT13_Gangplank_Spell_Melee.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Spell_Melee.TFT_Set13.anm` |
| Spell_Ranged_Summon | `ef6154e1` | Atomic | `TFT13_Gangplank_Spell_Ranged_Summon.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Spell_Ranged_Summon.TFT_Set13.anm` |
| Spell_Ranged_Blast | `8f2c87d8` | Atomic | `TFT13_Gangplank_Spell_Ranged_Blast.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Spell_Ranged_Blast.TFT_Set13.anm` |
| Crit_Ranged | `fa2cb865` | Atomic | `TFT13_Gangplank_Crit_Ranged.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Crit_Ranged.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `IdleRanged1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/IdleRanged1.TFT_Set13.anm` |
| Spell_Melee_Ignite | `6830cc91` | Atomic | `TFT13_Gangplank_Spell_Melee_Ignite.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Spell_Melee_Ignite.TFT_Set13.anm` |
| Idle1_Melee | `a7482ffd` | Atomic | `TFT13_Gangplank_Idle1_Melee.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/TFT13_Gangplank_Idle1_Melee.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Gangplank_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gangplank/Skins/Base/Animations/Gangplank_Death.TFT_Set13.anm` |

## kogmaw

cast：tft13_kogmaw_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_kogmaw/skins/skin0.bin`；SHA-256：`3ceed8073c83217b13ea7abf0cc0ef27c17bea72ad82b9820dc9418954bb1ee5`
- 源：`data/characters/tft13_kogmaw/skins/root.bin`；SHA-256：`d43be109bf1bf6b4e49aaa5cbfe2c8b8a3f9541906cfe6b4a149b9af695ea567`
- 源：`characters/tft13_kogmaw`；SHA-256：`85c6c4faebf651e1e5d1bf0c19f87c910825baff2741596143a8d6fffa1e2c1c`
- 源：`data/characters/tft13_kogmaw/animations/skin0.bin`；SHA-256：`4118a5d4ceec75482d4d70c640f9eff9d0222484f4bd4d09e5dc1f6af9340edf`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_KogMaw_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_KogMaw/Skins/Base/Animations/TFT13_KogMaw_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_KogMaw_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_KogMaw/Skins/Base/Animations/TFT13_KogMaw_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_KogMaw_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_KogMaw/Skins/Base/Animations/TFT13_KogMaw_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_KogMaw/Skins/Base/Animations/Death1.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_KogMaw_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_KogMaw/Skins/Base/Animations/TFT13_KogMaw_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_KogMaw_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_KogMaw/Skins/Base/Animations/TFT13_KogMaw_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Celebration1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_KogMaw/Skins/Base/Animations/Celebration1.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_KogMaw_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_KogMaw/Skins/Base/Animations/TFT13_KogMaw_Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_KogMaw/Skins/Base/Animations/Death1.TFT_Set13.anm` |

## loris（原缺 cast）

cast：spellup；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_beardy/skins/skin0.bin`；SHA-256：`cd8e4712dec29c6d7057e8d07221aa17c11bb376d42df60d38d8d010bfb429ea`
- 源：`data/characters/tft13_beardy/skins/root.bin`；SHA-256：`25eac8e044c11d1d9d87cfa0aca8a9ec6afac80f714c5d900e68a0567c0639ef`
- 源：`characters/tft13_beardy`；SHA-256：`a67366ab13095b1208835615cfd72e4bb164a12642ad118ae966c03687f8c5cc`
- 源：`data/characters/tft13_beardy/animations/skin0.bin`；SHA-256：`22a5080fa11defaf1151155187c1a782573d1f5ce1368476df7ae049c381349d`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Atk1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Beardy/Skins/Base/Animations/Atk1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Atk2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Beardy/Skins/Base/Animations/Atk2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Beardy/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Walk.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Beardy/Skins/Base/Animations/Walk.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Idle1 | `9dd9dc06` | Atomic | `Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Beardy/Skins/Base/Animations/Idle.TFT_Set13.anm` |
| Dance_Loop | `1fcb6757` | Atomic | `Dance_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Beardy/Skins/Base/Animations/Dance_Loop.TFT_Set13.anm` |
| Spell_Activate | `1e67e553` | Atomic | `spellup.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Beardy/Skins/Base/Animations/spellup.TFT_Set13.anm` |
| Spell_Out | `a2edf5d6` | Atomic | `SpellOut.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Beardy/Skins/Base/Animations/SpellOut.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Beardy/Skins/Base/Animations/Death.TFT_Set13.anm` |

## nami（原缺 cast）

cast：spell2；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_nami/skins/skin0.bin`；SHA-256：`b12fbfe3c2dbe31fa1fe6b36073f9ec87af2a749486b3ac739a4b0ba74aa9b37`
- 源：`data/characters/tft13_nami/skins/root.bin`；SHA-256：`c5df7bbf0cf4896482b5f8313e25c165cfc2acaa90ea31c5f6914e50cb44c107`
- 源：`characters/tft13_nami`；SHA-256：`57db68c304e6f54b3450a85182812054b27d3c435269a5bda733b7be19e4d88a`
- 源：`data/characters/tft13_nami/animations/skin0.bin`；SHA-256：`535d0e03d3194e902b11b704f2f87bc7cb5ed96b013dbf8b7bbf8846e2196279`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nami/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nami/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nami/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run_C.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nami/Skins/Base/Animations/Run_C.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nami/Skins/Base/Animations/Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Celebrate.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nami/Skins/Base/Animations/Celebrate.TFT_Set13.anm` |
| 未知 | `7edfaad7` | Atomic | `Spell2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nami/Skins/Base/Animations/Spell2.TFT_Set13.anm` |
| Spell2_Water | `73d67d35` | Atomic | `TFT13_Nami_Spell2_Water.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nami/Skins/Base/Animations/TFT13_Nami_Spell2_Water.TFT_Set13.anm` |
| Spell | `a96fc6c9` | 非 Atomic 0x2160b3ec | 无直接 ANM | — |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Nami/Skins/Base/Animations/Death.TFT_Set13.anm` |

## nunu（原缺 cast）

cast：tft13_nunuwillump_spell_activate；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_nunuwillump/skins/skin0.bin`；SHA-256：`46bb3b7d594d65ca6df57b627f3e1b12786b9d2b031a87611d1c420faf011a91`
- 源：`data/characters/tft13_nunuwillump/skins/root.bin`；SHA-256：`6e7bcc79408d8f7014127d71e4ef651a7c0e4a6988414129d81d3cddb0227993`
- 源：`characters/tft13_nunuwillump`；SHA-256：`a7b2f3a8581a6c76f65c565b6ac1e18c6ec4b053b19ca85a0ca15ee86bde5827`
- 源：`data/characters/tft13_nunuwillump/animations/skin0.bin`；SHA-256：`83cd179b85de86cc8114a0b8d810de6d586a174fcd00a48d6d2a92f1c5f9c39e`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_NunuWillump_Attack01.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/TFT13_NunuWillump_Attack01.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_NunuWillump_Attack02.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/TFT13_NunuWillump_Attack02.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_NunuWillump_Attack01.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/TFT13_NunuWillump_Attack01.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Nunu_Death01.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/Nunu_Death01.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_NunuWillump_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/TFT13_NunuWillump_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_NunuWillump_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/TFT13_NunuWillump_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Dance_Loop | `1fcb6757` | Atomic | `TFT13_NunuWillump_Dance_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/TFT13_NunuWillump_Dance_Loop.TFT_Set13.anm` |
| Spell_Activate | `1e67e553` | Atomic | `TFT13_NunuWillump_Spell_Activate.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/TFT13_NunuWillump_Spell_Activate.TFT_Set13.anm` |
| Spell_ToIdle | `c4c6dac5` | Atomic | `TFT13_NunuWillump_Spell_ToIdle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/TFT13_NunuWillump_Spell_ToIdle.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Nunu_Death01.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/Nunu_Death01.TFT_Set13.anm` |
| 未知 | `4b2cf4db` | Atomic | `TFT13_NunuWillump_Spell_Activate.TFT_Set13.anm` | `ASSETS/Characters/TFT13_NunuWillump/Skins/Base/Animations/TFT13_NunuWillump_Spell_Activate.TFT_Set13.anm` |

## renni（原缺 cast）

cast：spell1_stun_activate；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_chainsaw/skins/skin0.bin`；SHA-256：`d0a68a3f3cf01e4be74fe3d38de5edd39409ad20ed9d8af4db3cc888625157b9`
- 源：`data/characters/tft13_chainsaw/skins/root.bin`；SHA-256：`7b93dfcc0ebf6927033992632a44a47f539e50b23525ee92aa630e5b648c59cd`
- 源：`characters/tft13_chainsaw`；SHA-256：`414da2b1d615742cbf2e9682f458529455858bc33d0836206a11612ad6b116b7`
- 源：`data/characters/tft13_chainsaw/animations/skin0.bin`；SHA-256：`97019984c695a474ad139d2c70c6cb9b6b8ff41ed3f9b086e1154a779b966a16`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle_A.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Idle_A.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Celebration.TFT_Set13.anm` |
| Spell1_Throw | `209b15bf` | Atomic | `Spell1_Throw.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Spell1_Throw.TFT_Set13.anm` |
| Spell1_Stun | `178abc91` | Atomic | `Spell1_Stun.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Spell1_Stun.TFT_Set13.anm` |
| Spell1 | `b2f63868` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `5b946bf6` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Spell1_Stun_Activate | `554eb6ab` | Atomic | `Spell1_Stun_Activate.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Spell1_Stun_Activate.TFT_Set13.anm` |
| Spell1_Stun_Loop | `ef37da58` | Atomic | `Spell1_Stun_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Spell1_Stun_Loop.TFT_Set13.anm` |
| death_loop | `36fa7cec` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Death.TFT_Set13.anm` |
| 未知 | `21241afc` | Atomic | `Spell1_Stun.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Spell1_Stun.TFT_Set13.anm` |
| 未知 | `b5738284` | Atomic | `Spell1_Stun.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Chainsaw/Skins/Base/Animations/Spell1_Stun.TFT_Set13.anm` |

## scar

cast：spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_flyguy/skins/skin0.bin`；SHA-256：`c61a53f4264f41c00101fb29f163ecc788a11d871225cf5cc8f4ccc3bcce975d`
- 源：`data/characters/tft13_flyguy/skins/root.bin`；SHA-256：`d18cd6862a806444e22e811b44e94cad90d3c34c18a02dbea5272bc04d344419`
- 源：`characters/tft13_flyguy`；SHA-256：`a5787267754a0237589870d5cba8e90abd8ee7c21a47bd3d408fff4207304678`
- 源：`data/characters/tft13_flyguy/animations/skin0.bin`；SHA-256：`7136cb7b204542e80bbe753f8a0fcd15790bc577b4dc1aa7cacd1c883e402a69`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Atk1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/Atk1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Atk2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/Atk2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `Atk1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/Atk1.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/Idle.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Dance_Loop | `1fcb6757` | Atomic | `Celebration1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/Celebration1.TFT_Set13.anm` |
| 未知 | `bb3e6721` | Atomic | `Hoverboard.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/Hoverboard.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/Spell.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Walk.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/Walk.TFT_Set13.anm` |
| HoverboardThrow | `b9f97c05` | Atomic | `HoverboardThrow.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/HoverboardThrow.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_FlyGuy/Skins/Base/Animations/Death.TFT_Set13.anm` |

## smeech

cast：spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_gremlin/skins/skin0.bin`；SHA-256：`4c2d21bfe3db07e5bfa28673dac2a067f7fc788d1d6e716b1c25b54640e3fe9e`
- 源：`data/characters/tft13_gremlin/skins/root.bin`；SHA-256：`e9d74a6040c538febf956eb833d4acabfd6c83a52f337a23530ea1455882c3dd`
- 源：`characters/tft13_gremlin`；SHA-256：`2b1a99f1c069366005f50b1a8e2511f805eeacd64a67aca21ae505325740d211`
- 源：`data/characters/tft13_gremlin/animations/skin0.bin`；SHA-256：`709349ca57cf9179b6ed2ad47152c27a632166d6770c6fbfde49fb0dcb853700`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Idle2.TFT_Set13.anm` |
| 未知 | `1f8ea1b7` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Spell.TFT_Set13.anm` |
| SpellAntic | `a3e96636` | Atomic | `SpellAntic.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/SpellAntic.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Run.TFT_Set13.anm` |
| 未知 | `8be07c66` | Atomic | `Beat2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Beat2.TFT_Set13.anm` |
| 未知 | `8ee0811f` | Atomic | `Beat5.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Beat5.TFT_Set13.anm` |
| Crit_Antic | `2e500563` | Atomic | `Crit_Antic.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Crit_Antic.TFT_Set13.anm` |
| 未知 | `54f306c3` | Atomic | `Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Crit.TFT_Set13.anm` |
| 未知 | `9c4e23a6` | Atomic | `SpellAtkRight.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/SpellAtkRight.TFT_Set13.anm` |
| 未知 | `adb3cd84` | Atomic | `SpellAtkRight.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/SpellAtkRight.TFT_Set13.anm` |
| 未知 | `764f0595` | Atomic | `SpellAtkLeft.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/SpellAtkLeft.TFT_Set13.anm` |
| 未知 | `e1c67281` | Atomic | `SpellAtkLeft.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/SpellAtkLeft.TFT_Set13.anm` |
| 未知 | `581664d2` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| 未知 | `5716633f` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Crit.TFT_Set13.anm` |
| 未知 | `7b7f306f` | Atomic | `Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Crit.TFT_Set13.anm` |
| 未知 | `c860e613` | Atomic | `SpellAtkLeft.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/SpellAtkLeft.TFT_Set13.anm` |
| 未知 | `ff9cf89c` | Atomic | `SpellAtkRight.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/SpellAtkRight.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Gremlin/Skins/Base/Animations/Death.TFT_Set13.anm` |

## swain

cast：tft13_swain_spell_2；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_swain/skins/skin0.bin`；SHA-256：`3d66fb6fbfeac742fcc324df74d4bf46e0514690043f596318bddfdd03510787`
- 源：`data/characters/tft13_swain/skins/root.bin`；SHA-256：`36e5463eb64e0aad7b7d3b848d048222ab078946fc3454cfe7bfd5f12c4f3495`
- 源：`characters/tft13_swain`；SHA-256：`18c9f340124d88ec3e30e3072e64accf07e92d30d1be4829df8afd834be199ee`
- 源：`data/characters/tft13_swain/animations/skin0.bin`；SHA-256：`e46b58c55be36911fc529ba7455d5c5c535ae3e4e7a148bade9a495f59eccae2`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Swain_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/TFT13_Swain_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Swain_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/TFT13_Swain_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Swain_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/TFT13_Swain_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/Death1.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Swain_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/TFT13_Swain_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Idle_loop | `fa8d99da` | Atomic | `Swain_Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/Swain_Idle.TFT_Set13.anm` |
| Dance_Loop | `1fcb6757` | Atomic | `TFT13_Swain_Dance_loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/TFT13_Swain_Dance_loop.TFT_Set13.anm` |
| Spell2_In | `52f64265` | Atomic | `TFT13_Swain_Spell_2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/TFT13_Swain_Spell_2.TFT_Set13.anm` |
| Transform | `e1ad931b` | Atomic | `TFT13_Swain_Transform.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/TFT13_Swain_Transform.TFT_Set13.anm` |
| TransformOut | `70eb0dad` | Atomic | `TFT13_Swain_TransformOut.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/TFT13_Swain_TransformOut.TFT_Set13.anm` |
| Spell2_Out | `95f9046e` | Atomic | `TFT13_Swain_Spell2_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/TFT13_Swain_Spell2_Out.TFT_Set13.anm` |
| Spell2 | `b5f63d21` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| knockup | `297cd14a` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Swain/Skins/Base/Animations/Death1.TFT_Set13.anm` |

## twistedfate

cast：spell1；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_twistedfate/skins/skin0.bin`；SHA-256：`709ec5c5815443796413e823c86bf4f00de9e9a323262b235d75579d2e5dd38e`
- 源：`data/characters/tft13_twistedfate/skins/root.bin`；SHA-256：`c5d161ba74d2ef545007390c58749f90cef7fdd8c179d20d4f08e0e24685cce8`
- 源：`characters/tft13_twistedfate`；SHA-256：`ba694d84d708588425a7a8cb1180dcef945f9dae20117f14028df12093499e5d`
- 源：`data/characters/tft13_twistedfate/animations/skin0.bin`；SHA-256：`98c8a779d7742475b7c33a43d912e21e34c8077d951351185b482d20ca576c55`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_TwistedFate/Skins/Base/Animations/Attack1_new.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_TwistedFate_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_TwistedFate/Skins/Base/Animations/TFT13_TwistedFate_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_TwistedFate/Skins/Base/Animations/Death1.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_TwistedFate_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_TwistedFate/Skins/Base/Animations/TFT13_TwistedFate_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `ba9fda17` | Atomic | `Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_TwistedFate/Skins/Base/Animations/Idle1.TFT_Set13.anm` |
| Dance_Loop | `1fcb6757` | Atomic | `Dance1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_TwistedFate/Skins/Base/Animations/Dance1.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Spell1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_TwistedFate/Skins/Base/Animations/Spell1.TFT_Set13.anm` |
| Spell_In | `0ec457ed` | Atomic | `TFT13_TwistedFate_Spell_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_TwistedFate/Skins/Base/Animations/TFT13_TwistedFate_Spell_In.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_TwistedFate/Skins/Base/Animations/Death1.TFT_Set13.anm` |

## ambessa（原缺 cast）

cast：无法判定 / missing-atomic-action；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_ambessa/skins/skin0.bin`；SHA-256：`da6c26fac6aad6eb32917e5a0020c426d4f73e8ae26e5a10d3251bbca0b87b72`
- 源：`data/characters/tft13_ambessa/skins/root.bin`；SHA-256：`e533043248446e5850ca792b3e88a8e616e27f100f18ff42af4da536f337b8e1`
- 源：`characters/tft13_ambessa`；SHA-256：`12a20be8217489d4d1cb7dd5d06886890d99301618936ad083d4a54ee24414a7`
- 源：`data/characters/tft13_ambessa/animations/skin0.bin`；SHA-256：`85df863df5d694b12bce79b2ad1160d1598de30cd960cfd72374ca6ef675cb2f`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Ambessa_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Ambessa_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/dance.TFT_Set13.anm` |
| RunChains_Transfer | `f6e42b7a` | Atomic | `TFT13_Ambessa_RunChains_Transfer.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_RunChains_Transfer.TFT_Set13.anm` |
| DashChains | `bf15578f` | Atomic | `TFT13_Ambessa_DashChains.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_DashChains.TFT_Set13.anm` |
| SpellChain_Strike | `aa395d05` | Atomic | `TFT13_Ambessa_SpellChain_Strike.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_SpellChain_Strike.TFT_Set13.anm` |
| SpellFist_Dash | `18769200` | Atomic | `TFT13_Ambessa_SpellFist_Dash.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_SpellFist_Dash.TFT_Set13.anm` |
| SpellFist_Throw | `5c0d15f4` | Atomic | `TFT13_Ambessa_SpellFist_Throw.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_SpellFist_Throw.TFT_Set13.anm` |
| Attack1 | `56b1e924` | Atomic | `TFT13_Ambessa_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Ambessa_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Ambessa_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_Crit.TFT_Set13.anm` |
| CritChains | `ab8a5557` | Atomic | `TFT13_Ambessa_CritChains.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_CritChains.TFT_Set13.anm` |
| Attack1Chains | `ef23c81a` | Atomic | `TFT13_Ambessa_Attack1Chains.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_Attack1Chains.TFT_Set13.anm` |
| Attack2Chains | `13829a87` | Atomic | `TFT13_Ambessa_Attack2Chains.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_Attack2Chains.TFT_Set13.anm` |
| 未知 | `73d1c41c` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/Death.TFT_Set13.anm` |
| SpellFist_DashBackwards | `9b5ce62e` | Atomic | `TFT13_Ambessa_SpellFist_DashBackwards.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ambessa/Skins/Base/Animations/TFT13_Ambessa_SpellFist_DashBackwards.TFT_Set13.anm` |

## corki（原缺 cast）

cast：tft13_corki_spell_start；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_corki/skins/skin0.bin`；SHA-256：`fb9d2c89e5337bee4f9f94d050a6bc0f28f41c6ab27f4e27c54e4df5a4e12b08`
- 源：`data/characters/tft13_corki/skins/root.bin`；SHA-256：`5818bdbea9c58bbdf49c68b47d17abd6af226b1ac332974a0b61b6537c8210ee`
- 源：`characters/tft13_corki`；SHA-256：`b20cf2545aa5ce8cb41be767865b6a4b73c8e9d1b48a9f343339fa690f60742c`
- 源：`data/characters/tft13_corki/animations/skin0.bin`；SHA-256：`64577f0cb5d81628391010725dcc61e609045f61f165867ac3afb70b644a5899`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Corki_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Corki/Skins/Base/Animations/TFT13_Corki_attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Corki_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Corki/Skins/Base/Animations/TFT13_Corki_attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `TFT13_Corki_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Corki/Skins/Base/Animations/TFT13_Corki_death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Corki_run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Corki/Skins/Base/Animations/TFT13_Corki_run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Corki_idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Corki/Skins/Base/Animations/TFT13_Corki_idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Corki_dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Corki/Skins/Base/Animations/TFT13_Corki_dance.TFT_Set13.anm` |
| Spell_Start | `4eb40f3a` | Atomic | `TFT13_Corki_Spell_Start.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Corki/Skins/Base/Animations/TFT13_Corki_Spell_Start.TFT_Set13.anm` |
| Spell_Loop | `667e3c00` | Atomic | `TFT13_Corki_Spell_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Corki/Skins/Base/Animations/TFT13_Corki_Spell_Loop.TFT_Set13.anm` |
| Spell_End | `232acdcf` | Atomic | `TFT13_Corki_Spell_End.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Corki/Skins/Base/Animations/TFT13_Corki_Spell_End.TFT_Set13.anm` |
| Spell | `a96fc6c9` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| knockup | `297cd14a` | Atomic | `TFT13_Corki_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Corki/Skins/Base/Animations/TFT13_Corki_death.TFT_Set13.anm` |

## drmundo（原缺 cast）

cast：无法判定 / missing-atomic-action；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_drmundo/skins/skin0.bin`；SHA-256：`ad0a330eaaacbc2af33003277b19896b5fb78555aeb5aa065a9cc7fc7aee2700`
- 源：`data/characters/tft13_drmundo/skins/root.bin`；SHA-256：`9b537e84c960a30010a6754ce52b2d2ad8bb4e042f6749e4586abc68c2490eba`
- 源：`characters/tft13_drmundo`；SHA-256：`50d439c72a948e61866d64b2981e8c038cec72b5932d247bb12c1f30569b045c`
- 源：`data/characters/tft13_drmundo/animations/skin0.bin`；SHA-256：`dd180cab25337a4a234534dc06fd4151ae289921a2a39af9d90faabec5845719`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1_In | `0342d882` | Atomic | `TFT13_DrMundo_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Attack1.TFT_Set13.anm` |
| Attack2_In | `7b63d3c9` | Atomic | `TFT13_DrMundo_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `DrMundo_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/DrMundo_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_DrMundo_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_DrMundo_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Dance_Loop | `1fcb6757` | Atomic | `TFT13_DrMundo_Dance_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Dance_Loop.TFT_Set13.anm` |
| Attack1 | `56b1e924` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Attack2 | `59b1eddd` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Spell4_Idle | `b5b5425a` | Atomic | `TFT13_DrMundo_Spell4_Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Spell4_Idle.TFT_Set13.anm` |
| Spell4_Out_Idle | `82b76ebf` | Atomic | `TFT13_DrMundo_Spell4_Out_Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Spell4_Out_Idle.TFT_Set13.anm` |
| Spell4_Out_Run | `84587d36` | Atomic | `TFT13_DrMundo_Spell4_Out_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Spell4_Out_Run.TFT_Set13.anm` |
| Spell4_Run | `c072c49d` | Atomic | `TFT13_DrMundo_Spell4_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Spell4_Run.TFT_Set13.anm` |
| Spell4 | `b7f64047` | 非 Atomic 0x1560dccc | 无直接 ANM | — |
| spell4_out | `aeb0878c` | 非 Atomic 0x1560dccc | 无直接 ANM | — |
| Attack1_Out | `b3dc4d1b` | Atomic | `TFT13_DrMundo_Attack1_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Attack1_Out.TFT_Set13.anm` |
| Attack2_Out | `6f6794ca` | Atomic | `TFT13_DrMundo_Attack2_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/TFT13_DrMundo_Attack2_Out.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `DrMundo_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_DrMundo/Skins/Base/Animations/DrMundo_Death.TFT_Set13.anm` |

## ekko（原缺 cast）

cast：tft13_ekko_spell_start；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_ekko/skins/skin0.bin`；SHA-256：`2bae88ba19120fd8935aff62cf2a6e5e5324c6c0b163dac1e73d3792c6307836`
- 源：`data/characters/tft13_ekko/skins/root.bin`；SHA-256：`dcab5c914744647eae4afc2530bef31c94f53a32cf3d2819289799dd14499f31`
- 源：`characters/tft13_ekko`；SHA-256：`77ca976f6b46c3a203af25db4c1a2699df7cf64724d2889d0d6250294e7f6a96`
- 源：`data/characters/tft13_ekko/animations/skin0.bin`；SHA-256：`b5b1533d96482e48359214fddd75fd8a9591bc6e335ececceb8fc1f07b8017fc`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `PunkGenius_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/PunkGenius_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `PunkGenius_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/PunkGenius_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `PunkGenius_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/PunkGenius_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `PunkGenius_Run1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/PunkGenius_Run1.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `idle_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/idle_new.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Dance_Loop | `1fcb6757` | Atomic | `PunkGenius_Dance_loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/PunkGenius_Dance_loop.TFT_Set13.anm` |
| 未知 | `bb3e6721` | Atomic | `Hoverboard_idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/Hoverboard_idle.TFT_Set13.anm` |
| Spell_Start | `4eb40f3a` | Atomic | `TFT13_Ekko_Spell_Start.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/TFT13_Ekko_Spell_Start.TFT_Set13.anm` |
| Spell_Teleport_Out | `93d5b612` | Atomic | `TFT13_Ekko_Spell_Teleport_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/TFT13_Ekko_Spell_Teleport_Out.TFT_Set13.anm` |
| Spell_Attack | `121e3dee` | Atomic | `TFT13_Ekko_Spell_Attack.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/TFT13_Ekko_Spell_Attack.TFT_Set13.anm` |
| Spell_Teleport_In | `eac900f1` | Atomic | `TFT13_Ekko_Spell_Teleport_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/TFT13_Ekko_Spell_Teleport_In.TFT_Set13.anm` |
| Spell_Attack_2 | `872f8b43` | Atomic | `TFT13_Ekko_Spell_Attack_2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/TFT13_Ekko_Spell_Attack_2.TFT_Set13.anm` |
| Spell_Attack_3 | `862f89b0` | Atomic | `TFT13_Ekko_Spell_Attack_3.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/TFT13_Ekko_Spell_Attack_3.TFT_Set13.anm` |
| HoverboardThrow | `b9f97c05` | Atomic | `Hoverboard_throw.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/Hoverboard_throw.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Ekko/Skins/Base/Animations/Death.TFT_Set13.anm` |

## elise

cast：tft13_elise_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_elise/skins/skin0.bin`；SHA-256：`a7b11e4a9076c85d07d3899f4abe5669e35718751b36d946b4c3e215a229f5cb`
- 源：`data/characters/tft13_elise/skins/root.bin`；SHA-256：`1cd9b74572a01f21abe9d18a8539897b047181dd12c3c6a9fa10dacefd67ecd9`
- 源：`characters/tft13_elise`；SHA-256：`b658ab11e76a836a5643ec892880dd0a726da45f384e0865cc91451f961f07b9`
- 源：`data/characters/tft13_elise/animations/skin0.bin`；SHA-256：`7a57787329f40acb2fab25f79212c091b06d5100ae6f4963a4ffd77d805010c4`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Elise_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Elise/Skins/Base/Animations/TFT13_Elise_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Elise_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Elise/Skins/Base/Animations/TFT13_Elise_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Elise_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Elise/Skins/Base/Animations/TFT13_Elise_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Elise/Skins/Base/Animations/Death1.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Elise_Run1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Elise/Skins/Base/Animations/TFT13_Elise_Run1.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Elise_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Elise/Skins/Base/Animations/TFT13_Elise_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `612f3b96` | Atomic | `TFT13_Elise_Dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Elise/Skins/Base/Animations/TFT13_Elise_Dance.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Elise_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Elise/Skins/Base/Animations/TFT13_Elise_Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Elise/Skins/Base/Animations/Death1.TFT_Set13.anm` |

## garen

cast：tft13_garen_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_garen/skins/skin0.bin`；SHA-256：`3cccd15f783a4297d1db59b2be450a212d81f9074854fe2c180ce370b98736e1`
- 源：`data/characters/tft13_garen/skins/root.bin`；SHA-256：`6137afa65fe1f18b1743d81bdaaf87778593717d6c57dc28fa69b6f8ceba0221`
- 源：`characters/tft13_garen`；SHA-256：`eaa916e9c625b17272b764494365dafcfee5389550812f6a8350820806f11456`
- 源：`data/characters/tft13_garen/animations/skin0.bin`；SHA-256：`97bdc3e3efaa7729243ab83e1ecb087fc29bf9bd885150a3386bd69a0e0cdb8d`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Garen_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Garen/Skins/Base/Animations/TFT13_Garen_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Garen_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Garen/Skins/Base/Animations/TFT13_Garen_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Garen_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Garen/Skins/Base/Animations/Garen_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Garen_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Garen/Skins/Base/Animations/TFT13_Garen_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Garen_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Garen/Skins/Base/Animations/TFT13_Garen_Idle1.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Garen_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Garen/Skins/Base/Animations/TFT13_Garen_Spell.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Garen_Celebration_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Garen/Skins/Base/Animations/TFT13_Garen_Celebration_Loop.TFT_Set13.anm` |
| JANNA_SPIN | `94d79bc4` | Atomic | `TFT13_Garen_JANNA_SPIN.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Garen/Skins/Base/Animations/TFT13_Garen_JANNA_SPIN.TFT_Set13.anm` |
| death_loop | `36fa7cec` | Atomic | `Garen_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Garen/Skins/Base/Animations/Garen_Death.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Garen_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Garen/Skins/Base/Animations/Garen_Death.TFT_Set13.anm` |

## heimerdinger

cast：tft13_heimerdinger_spell1；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_heimerdinger/skins/skin0.bin`；SHA-256：`be4cd827a638f5e14ac04ea6f44f98998ce8aedc020824140281b29ac1e92cab`
- 源：`data/characters/tft13_heimerdinger/skins/root.bin`；SHA-256：`6bc701d87115385123ae0ee1d3c865f25d417bf91a1c2244b9000a22b26ac4fa`
- 源：`characters/tft13_heimerdinger`；SHA-256：`d0adf99e51ecceee732cf6d9601dd7336f30607d1542c1bab17939f8dad002d6`
- 源：`data/characters/tft13_heimerdinger/animations/skin0.bin`；SHA-256：`1cc1f20f6e6876d0fc6a36102a2d9dbe05874d57689f9021dddbe213ad809fb6`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Heimerdinger_Base_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Heimerdinger/Skins/Base/Animations/TFT13_Heimerdinger_Base_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Heimerdinger_Base_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Heimerdinger/Skins/Base/Animations/TFT13_Heimerdinger_Base_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Heimerdinger_Base_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Heimerdinger/Skins/Base/Animations/Heimerdinger_Base_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Heimerdinger_Base_Run1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Heimerdinger/Skins/Base/Animations/TFT13_Heimerdinger_Base_Run1.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Heimerdinger_Base_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Heimerdinger/Skins/Base/Animations/TFT13_Heimerdinger_Base_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Heimerdinger_Dance_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Heimerdinger/Skins/Base/Animations/Heimerdinger_Dance_Loop.TFT_Set13.anm` |
| Spell2 | `b5f63d21` | Atomic | `TFT13_Heimerdinger_Spell2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Heimerdinger/Skins/Base/Animations/TFT13_Heimerdinger_Spell2.TFT_Set13.anm` |
| 未知 | `d5428e02` | Atomic | `TFT13_Heimerdinger_Spell1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Heimerdinger/Skins/Base/Animations/TFT13_Heimerdinger_Spell1.TFT_Set13.anm` |
| Spell | `a96fc6c9` | 非 Atomic 0x2160b3ec | 无直接 ANM | — |
| 未知 | `a5a6ead9` | Atomic | `TFT13_Heimerdinger_Spell1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Heimerdinger/Skins/Base/Animations/TFT13_Heimerdinger_Spell1.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `TFT13_Heimerdinger_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Heimerdinger/Skins/Base/Animations/TFT13_Heimerdinger_Death.TFT_Set13.anm` |

## illaoi（原缺 cast）

cast：tft13_illaoi_spell_intro；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_illaoi/skins/skin0.bin`；SHA-256：`523a42b6c4b8cbad9179e1fc378ba12c1f79295559517ef8bffa5bd25c466425`
- 源：`data/characters/tft13_illaoi/skins/root.bin`；SHA-256：`f3cb0ed5954e345067f5bdde880133172b213c83503672a7e371430667d56b8f`
- 源：`characters/tft13_illaoi`；SHA-256：`15e178cb6e0bc85deaa600a4adb2563096bf681bfc2b6c406794bf877cea9c54`
- 源：`data/characters/tft13_illaoi/animations/skin0.bin`；SHA-256：`03b03fbe5e4c8256f66083fadf506de6d33b7097c0f4e766c34f4d55c26145ba`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Illaoi_Attack3.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/TFT13_Illaoi_Attack3.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Illaoi_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/Illaoi_attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Illaoi_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/Illaoi_Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Illaoi_Run1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/TFT13_Illaoi_Run1.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Illaoi_Skin02_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/TFT13_Illaoi_Skin02_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Illaoi_Dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/TFT13_Illaoi_Dance.TFT_Set13.anm` |
| RebelCelebration | `d4a57f71` | Atomic | `TFT13_Illaoi_RebelCelebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/TFT13_Illaoi_RebelCelebration.TFT_Set13.anm` |
| Spell | `a96fc6c9` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Spell_Intro | `4ac0486c` | Atomic | `TFT13_Illaoi_Spell_Intro.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/TFT13_Illaoi_Spell_Intro.TFT_Set13.anm` |
| Spell_Loop | `667e3c00` | Atomic | `TFT13_Illaoi_Spell_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/TFT13_Illaoi_Spell_Loop.TFT_Set13.anm` |
| Spell_Finish_In | `f992b5d9` | Atomic | `TFT13_Illaoi_Spell_Finish_In.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/TFT13_Illaoi_Spell_Finish_In.TFT_Set13.anm` |
| Spell_Finish_Out | `0384f37a` | Atomic | `TFT13_Illaoi_Spell_Finish_Out.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/TFT13_Illaoi_Spell_Finish_Out.TFT_Set13.anm` |
| 未知 | `52904d6d` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| knockup | `297cd14a` | Atomic | `Illaoi_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/Illaoi_Death.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `Illaoi_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Illaoi/Skins/Base/Animations/Illaoi_attack2.TFT_Set13.anm` |

## silco

cast：tft13_silco_spell1；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_silco/skins/skin0.bin`；SHA-256：`ba7481c3d30aa40b7378aed8456c839d944c85037930fa5455c996f1d4128a59`
- 源：`data/characters/tft13_silco/skins/root.bin`；SHA-256：`1231134b1324bb9f5c9a4d436d5643d0342dcc904f5adb1ac6a04fa505aeab1c`
- 源：`characters/tft13_silco`；SHA-256：`87ad3f9569bfdafbc4ac5459b6911b577e528d1dfb850290987933ee448aaf9d`
- 源：`data/characters/tft13_silco/animations/skin0.bin`；SHA-256：`16a1d4847a82adb3e55dc190003b53992d609e22195ae41a6cb815f1d7c6312e`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT6_Silco_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Silco/Skins/Base/Animations/TFT6_Silco_attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT6_Silco_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Silco/Skins/Base/Animations/TFT6_Silco_attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `TFT6_Silco_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Silco/Skins/Base/Animations/TFT6_Silco_death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT6_Silco_run.anm` | `ASSETS/Characters/TFT6_Silco/Skins/Base/Animations/TFT6_Silco_run.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle_New.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Silco/Skins/Base/Animations/Idle_New.TFT_Set13.anm` |
| Spell1 | `b2f63868` | Atomic | `TFT13_Silco_Spell1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Silco/Skins/Base/Animations/TFT13_Silco_Spell1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT6_Silco_CelebrateLOOP.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Silco/Skins/Base/Animations/TFT6_Silco_CelebrateLOOP.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `TFT6_Silco_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Silco/Skins/Base/Animations/TFT6_Silco_death.TFT_Set13.anm` |

## twitch

cast：twitch_spell_activate；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_twitch/skins/skin0.bin`；SHA-256：`cdfbe9c497c4e2eeb4ae680693e03e358e69601b7dd0c00e004fa7703f961d00`
- 源：`data/characters/tft13_twitch/skins/root.bin`；SHA-256：`cf371f862d09a08c3b9e1a79cf703bf363290f66a39a79ba9c053facac4f56c7`
- 源：`characters/tft13_twitch`；SHA-256：`cad94c921b42b4bc8bbbcb4cfd3a99e3c19732222fed444e26992b37c32e33b4`
- 源：`data/characters/tft13_twitch/animations/skin0.bin`；SHA-256：`8823f74b8ea6b6fb5dac9c838e07b8a1936954cea5ef5105b94eba63cba3fcc9`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Twitch_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/Twitch_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Twitch_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/Twitch_Attack1.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Twitch_Base_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/TFT13_Twitch_Base_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Twitch__Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/Twitch__Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `twitch_Run1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/twitch_Run1.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Twitch_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/Twitch_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Twitch_Dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/Twitch_Dance.TFT_Set13.anm` |
| Spell_Attack | `121e3dee` | Atomic | `Twitch_Spell4.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/Twitch_Spell4.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Twitch_Spell_Activate.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/Twitch_Spell_Activate.TFT_Set13.anm` |
| death_loop | `36fa7cec` | Atomic | `Twitch__Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/Twitch__Death.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Twitch__Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Twitch/Skins/Base/Animations/Twitch__Death.TFT_Set13.anm` |

## vi

cast：vi_spell4_hit；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_vi/skins/skin0.bin`；SHA-256：`0bc63df552c87ec5d72b5d62abbcc739053635a18dd55c43a35fce677451341b`
- 源：`data/characters/tft13_vi/skins/root.bin`；SHA-256：`05f80b8f01c30f210df2d751d5985631ced5d7cf0b669a977b8a819bd0078f4d`
- 源：`characters/tft13_vi`；SHA-256：`5090d86e7c9d0822be3827c639f58cb4049199576696c9cd727657eaa9a4a334`
- 源：`data/characters/tft13_vi/animations/skin0.bin`；SHA-256：`549b7b17c867d385baecc092fb7002b8e8dd7ea8e7c0b8ac6cec33555cbf00fc`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Vi_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Vi_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `Vi_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Vi_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Death.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `vi_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/vi_Idle1.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Vi_Run1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Run1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Vi_Dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Dance.TFT_Set13.anm` |
| 未知 | `821bfd3b` | Atomic | `Vi_Spell4_hit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Spell4_hit.TFT_Set13.anm` |
| 未知 | `60816d32` | Atomic | `Vi_Dash.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Dash.TFT_Set13.anm` |
| attack1_loop | `80c6a1cf` | Atomic | `Vi_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Attack1.TFT_Set13.anm` |
| attack2_loop | `2afa66dc` | Atomic | `Vi_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Attack2.TFT_Set13.anm` |
| crit_loop | `a415c02c` | Atomic | `Vi_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Crit.TFT_Set13.anm` |
| death_loop | `36fa7cec` | Atomic | `Vi_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Death.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Vi_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Vi/Skins/Base/Animations/Vi_Death.TFT_Set13.anm` |

## zoe

cast：spell1_base；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_zoe/skins/skin0.bin`；SHA-256：`af43f8fc9ecbf8940e64b580a52e52b1a9876e6e0a9ec74ab86534433a0fc641`
- 源：`data/characters/tft13_zoe/skins/root.bin`；SHA-256：`6644c46d7ca4c33f1ba6818dbe26fe9f254f1e9575e0277d0df958ec02f7e06f`
- 源：`characters/tft13_zoe`；SHA-256：`fbec2cc89b7b6005c613ac73bd70b35eaf6db20eebe1588e15dabcc070dd9105`
- 源：`data/characters/tft13_zoe/animations/skin0.bin`；SHA-256：`060559d818c3270f531dcefc07e13efb2837fda20eac203b75eb7346197c8072`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Zoe_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zoe/Skins/Base/Animations/Zoe_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Zoe_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zoe/Skins/Base/Animations/Zoe_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Zoe_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zoe/Skins/Base/Animations/Zoe_Death.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Zoe_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zoe/Skins/Base/Animations/Zoe_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Zoe_Dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zoe/Skins/Base/Animations/Zoe_Dance.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `Spell1_base.anm` | `ASSETS/Characters/Zoe/Skins/Base/Animations/Spell1_base.anm` |
| Run | `2acd4eca` | Atomic | `Zoe_Run1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zoe/Skins/Base/Animations/Zoe_Run1.TFT_Set13.anm` |
| Spell2 | `b5f63d21` | Atomic | `TFT13_Zoe_Spell2_A.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zoe/Skins/Base/Animations/TFT13_Zoe_Spell2_A.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `Zoe_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zoe/Skins/Base/Animations/Zoe_Attack1.TFT_Set13.anm` |
| death_loop | `36fa7cec` | Atomic | `Zoe_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zoe/Skins/Base/Animations/Zoe_Death.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Zoe_Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Zoe/Skins/Base/Animations/Zoe_Death.TFT_Set13.anm` |

## caitlyn（原缺 cast）

cast：tft13_caitlyn_spell_first；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_caitlyn/skins/skin0.bin`；SHA-256：`70e76744afbffe8c3f7ea66b5c01256e472e571805e91629048b9ea1307ab601`
- 源：`data/characters/tft13_caitlyn/skins/root.bin`；SHA-256：`0c1a557fd94cd0f0578f50c2cec820a023b62d7e021e233759a1cd9da6e0eed7`
- 源：`characters/tft13_caitlyn`；SHA-256：`1e2bb38d7423308468573462bc4abbcd80b02105e0f2b6b9b1fae0cf93f01ee1`
- 源：`data/characters/tft13_caitlyn/animations/skin0.bin`；SHA-256：`64b1c94ea87d5683e12a38419b8d7887b34c36778236641a29cce175275be51c`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Caitlyn_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Caitlyn_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Caitlyn_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Dance_LOOP.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Dance_LOOP.TFT_Set13.anm` |
| 未知 | `eeea4632` | Atomic | `Attack1_to_Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Attack1_to_Idle.TFT_Set13.anm` |
| 未知 | `93324591` | Atomic | `Attack2_to_Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Attack2_to_Idle.TFT_Set13.anm` |
| 未知 | `32557be1` | Atomic | `Crit_to_Idle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Crit_to_Idle.TFT_Set13.anm` |
| Spell_First | `55e162a8` | Atomic | `TFT13_Caitlyn_Spell_First.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Spell_First.TFT_Set13.anm` |
| Spell_Shoot | `524755e1` | Atomic | `TFT13_Caitlyn_Spell_Shoot.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Spell_Shoot.TFT_Set13.anm` |
| Spell_Shoot_90 | `6ea45f8b` | Atomic | `TFT13_Caitlyn_Spell_Shoot_90.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Spell_Shoot_90.TFT_Set13.anm` |
| Spell_Shoot_-90 | `dbda0e1c` | Atomic | `TFT13_Caitlyn_Spell_Shoot_-90.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Spell_Shoot_-90.TFT_Set13.anm` |
| Spell_Shoot_toIdle | `694e29ed` | Atomic | `TFT13_Caitlyn_Spell_Shoot_toIdle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Spell_Shoot_toIdle.TFT_Set13.anm` |
| 未知 | `a71cb84a` | 非 Atomic 0xf2b2e7c1 | 无直接 ANM | — |
| Headshot | `d7a77563` | Atomic | `TFT13_Caitlyn_Headshot.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Headshot.TFT_Set13.anm` |
| Headshot_toIdle | `62e9eb2b` | Atomic | `TFT13_Caitlyn_Headshot_toIdle.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Headshot_toIdle.TFT_Set13.anm` |
| 未知 | `18227248` | Atomic | `TFT13_Caitlyn_Spell_Shoot.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Spell_Shoot.TFT_Set13.anm` |
| 未知 | `db1428e8` | Atomic | `TFT13_Caitlyn_Spell_Shoot.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Spell_Shoot.TFT_Set13.anm` |
| death_loop | `36fa7cec` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Death.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/Death.TFT_Set13.anm` |
| 未知 | `8c38939f` | Atomic | `TFT13_Caitlyn_Spell_Shoot.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Caitlyn/Skins/Base/Animations/TFT13_Caitlyn_Spell_Shoot.TFT_Set13.anm` |

## jayce（原缺 cast）

cast：无法判定 / ambiguous-action；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_jayce/skins/skin0.bin`；SHA-256：`b51a233d17dbda4b694de6dcb9c943820fc6d2d3b44e0b81bd77b826d37e6550`
- 源：`data/characters/tft13_jayce/skins/root.bin`；SHA-256：`ac89fda6089704b91cab571b4891b57461ffd248e63b12aed83faf75a6925082`
- 源：`characters/tft13_jayce`；SHA-256：`de7d4e202373ee3761054498bba9dd0c0011645187f15483e503a14556f80f97`
- 源：`data/characters/tft13_jayce/animations/skin0.bin`；SHA-256：`4c9e7be9a41dc79bb3655e3170dd5723d2cc6a365fec2d81156e74621d50e9e6`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Jayce_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Jayce_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Jayce_Crit.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Crit.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Jayce_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/Jayce_death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Jayce_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Run.TFT_Set13.anm` |
| Idle1_Melee | `a7482ffd` | Atomic | `TFT13_Jayce_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `TFT13_Jayce_Celebration.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Celebration.TFT_Set13.anm` |
| Attack1_Ranged | `93974bbe` | Atomic | `TFT13_Jayce_Attack1_Ranged.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Attack1_Ranged.TFT_Set13.anm` |
| Crit_Ranged | `fa2cb865` | Atomic | `TFT13_Jayce_Attack1_Ranged.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Attack1_Ranged.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Jayce_Idle1_Ranged.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Idle1_Ranged.TFT_Set13.anm` |
| Spell2_Ranged_Jump | `dac06daa` | Atomic | `TFT13_Jayce_Spell2_Ranged_Jump.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Spell2_Ranged_Jump.TFT_Set13.anm` |
| Spell2_KnockHexCrystals | `9299d710` | Atomic | `TFT13_Jayce_Spell2_KnockHexCrystals.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Spell2_KnockHexCrystals.TFT_Set13.anm` |
| CallShield | `f44e76ac` | Atomic | `TFT13_Jayce_CallShield.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_CallShield.TFT_Set13.anm` |
| Spell1_GainShield | `e8ed6ca3` | Atomic | `TFT13_Jayce_Spell1_GainShield.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Spell1_GainShield.TFT_Set13.anm` |
| 未知 | `783ab468` | Atomic | `TFT13_Jayce_Spell2_Ranged_Jump.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Spell2_Ranged_Jump.TFT_Set13.anm` |
| 未知 | `a0d28360` | Atomic | `TFT13_Jayce_Spell1_GainShield.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Spell1_GainShield.TFT_Set13.anm` |
| Spell1_Right | `693d3f15` | Atomic | `TFT13_Jayce_Spell1_Right.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/TFT13_Jayce_Spell1_Right.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Jayce_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jayce/Skins/Base/Animations/Jayce_death.TFT_Set13.anm` |

## jinx

cast：tft13_jinx_spell_deathrocket；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_jinx/skins/skin0.bin`；SHA-256：`62020041f7824e8182643046a7e5f7e464f04464dcb4f3254f4672724db8f0df`
- 源：`data/characters/tft13_jinx/skins/root.bin`；SHA-256：`2ebb892a8b69ca71f2f0b75684f23461e5b158ee30a457b13789db0c4803920f`
- 源：`characters/tft13_jinx`；SHA-256：`7d878bcde9d7f7d834d94820417d631e1a1ee519a57024f2e9248ebf816515e4`
- 源：`data/characters/tft13_jinx/animations/skin0.bin`；SHA-256：`d31af02da340463a237a2b22441d1773fff3faa73328d3e69855dab9c4b3d97d`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Jinx_minigun_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_minigun_attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Jinx_minigun_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_minigun_attack1.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Jinx_minigun_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_minigun_attack1.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Jinx_minigun_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/Jinx_minigun_death.TFT_Set13.anm` |
| Run | `2acd4eca` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Jinx_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `bdaf4563` | Atomic | `TFT13_Jinx_minigun_run_in.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_minigun_run_in.TFT_Set13.anm` |
| 未知 | `f112f5b2` | Atomic | `TFT13_Jinx_minigun_run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_minigun_run.TFT_Set13.anm` |
| Dance_Loop | `1fcb6757` | Atomic | `TFT13_Jinx_Dance_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Dance_Loop.TFT_Set13.anm` |
| Spell_Zap | `5fad3461` | Atomic | `TFT13_Jinx_Spell_Zap.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Spell_Zap.TFT_Set13.anm` |
| Spell_FlameChompers | `c26c9a26` | Atomic | `TFT13_Jinx_Spell_FlameChompers.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Spell_FlameChompers.TFT_Set13.anm` |
| 未知 | `4ac62b35` | Atomic | `TFT13_Jinx_Spell_DeathRocket.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Spell_DeathRocket.TFT_Set13.anm` |
| 未知 | `47c6267c` | Atomic | `TFT13_Jinx_Spell_DeathRocket2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Spell_DeathRocket2.TFT_Set13.anm` |
| 未知 | `48c6280f` | Atomic | `TFT13_Jinx_Spell_DeathRocket2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Spell_DeathRocket2.TFT_Set13.anm` |
| Spell_DeathRocket | `efbcc130` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| AfterDeathRocket | `97d7ec69` | Atomic | `TFT13_Jinx_AfterDeathRocket.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_AfterDeathRocket.TFT_Set13.anm` |
| Attack3 | `58b1ec4a` | Atomic | `TFT13_Jinx_minigun_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_minigun_attack1.TFT_Set13.anm` |
| Attack4 | `53b1e46b` | Atomic | `TFT13_Jinx_Attack4.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Attack4.TFT_Set13.anm` |
| 未知 | `52b1e2d8` | Atomic | `TFT13_Jinx_Attack4.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Attack4.TFT_Set13.anm` |
| 未知 | `55b1e791` | Atomic | `TFT13_Jinx_Attack4.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Attack4.TFT_Set13.anm` |
| 未知 | `785d499f` | Atomic | `Jinx_Ceremony.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/Jinx_Ceremony.TFT_Set13.anm` |
| 未知 | `3d97537f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `2d4a92de` | Atomic | `Jinx_Ceremony_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/Jinx_Ceremony_Loop.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Jinx_minigun_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/Jinx_minigun_death.TFT_Set13.anm` |
| Star3_Intro | `1d16b1c7` | Atomic | `TFT13_Jinx_Star3_Intro.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Star3_Intro.TFT_Set13.anm` |
| Star3_Loop | `64739159` | Atomic | `TFT13_Jinx_Star3_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Star3_Loop.TFT_Set13.anm` |
| Star3_Launch | `c8a4c3d4` | Atomic | `TFT13_Jinx_Star3_Launch.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Star3_Launch.TFT_Set13.anm` |
| Star3_Land | `e9121636` | Atomic | `TFT13_Jinx_Star3_Land.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_Star3_Land.TFT_Set13.anm` |
| 未知 | `78e75379` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `5d0151c7` | Atomic | `TFT13_Jinx_MacaoLanding.TFT_Set13_MacaoMode.anm` | `ASSETS/Characters/TFT13_Jinx/Skins/Base/Animations/TFT13_Jinx_MacaoLanding.TFT_Set13_MacaoMode.anm` |

## leblanc

cast：tft13_leblanc_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_leblanc/skins/skin0.bin`；SHA-256：`301f3cd0008cbde1014e93837478037acafdbf5770901095963f5c0fafe005fa`
- 源：`data/characters/tft13_leblanc/skins/root.bin`；SHA-256：`9acb66e1d3b410ce64e0743d78870db95c7739e87c42a0043fc36895678a9632`
- 源：`characters/tft13_leblanc`；SHA-256：`104d5b325c4a84e2fe53f974a19fe2813cc6c8036e20c6a20e60578de037efbe`
- 源：`data/characters/tft13_leblanc/animations/skin0.bin`；SHA-256：`9a7212005611d58ec149dd4c88370c1b43d10ad0585314141e1432df52b8d033`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_LeBlanc_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/TFT13_LeBlanc_attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_LeBlanc_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/TFT13_LeBlanc_attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `LeBlanc_Death_New.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/LeBlanc_Death_New.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_LeBlanc_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/TFT13_LeBlanc_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `idle_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/idle_new.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `leblanc_dance_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/leblanc_dance_new.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_LeBlanc_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/TFT13_LeBlanc_Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `LeBlanc_Death_New.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/LeBlanc_Death_New.TFT_Set13.anm` |
| attack1_end | `55c93006` | Atomic | `TFT13_LeBlanc_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/TFT13_LeBlanc_attack1.TFT_Set13.anm` |
| attack2_end | `dfcb6303` | Atomic | `TFT13_LeBlanc_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/TFT13_LeBlanc_attack2.TFT_Set13.anm` |
| attack2_loop | `2afa66dc` | Atomic | `TFT13_LeBlanc_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/TFT13_LeBlanc_attack2.TFT_Set13.anm` |
| attack1_loop | `80c6a1cf` | Atomic | `TFT13_LeBlanc_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_LeBlanc/Skins/Base/Animations/TFT13_LeBlanc_attack1.TFT_Set13.anm` |
| 未知 | `0b59cad6` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `8f8791fd` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |

## malzahar

cast：tft13_malzahar_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_malzahar/skins/skin0.bin`；SHA-256：`2d7009e8d5fc9fdbff9c43a6f0247154a3a5eecd327b3399facc7a66218cd62f`
- 源：`data/characters/tft13_malzahar/skins/root.bin`；SHA-256：`bf290e31dbd7013b990046c89d92b12cb24e23203af18057fdf6fd9afc11ff3b`
- 源：`characters/tft13_malzahar`；SHA-256：`08dee6433153bcc7aa099b458d7859626594f0b06f52b5c056e4c9f006b3e93c`
- 源：`data/characters/tft13_malzahar/animations/skin0.bin`；SHA-256：`a29dc53e51219647ef3589177be4b8c27d96025515035dde322c679205548204`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Malzahar_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Malzahar/Skins/Base/Animations/TFT13_Malzahar_attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Malzahar_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Malzahar/Skins/Base/Animations/TFT13_Malzahar_attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Malzahar_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Malzahar/Skins/Base/Animations/TFT13_Malzahar_attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `malzahar_skin06_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Malzahar/Skins/Base/Animations/malzahar_skin06_death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Malzahar_run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Malzahar/Skins/Base/Animations/TFT13_Malzahar_run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Malzahar_skin06_idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Malzahar/Skins/Base/Animations/TFT13_Malzahar_skin06_idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `malzahar_skin06_dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Malzahar/Skins/Base/Animations/malzahar_skin06_dance.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Malzahar_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Malzahar/Skins/Base/Animations/TFT13_Malzahar_Spell.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `malzahar_skin06_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Malzahar/Skins/Base/Animations/malzahar_skin06_death.TFT_Set13.anm` |

## mordekaiser

cast：tft13_mordekaiser_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_mordekaiser/skins/skin0.bin`；SHA-256：`9f22e2dae5101711cde80474bfddf948a8c4db573657aa4dd64e728e3d216796`
- 源：`data/characters/tft13_mordekaiser/skins/root.bin`；SHA-256：`f18f8a57098ece956fec9ac006d0d427c110733839b1c94752986f1571e89cab`
- 源：`characters/tft13_mordekaiser`；SHA-256：`a72a1978ee752c021b37859c8ae217f8631271f3369addf0e1b7b29c65a17d3c`
- 源：`data/characters/tft13_mordekaiser/animations/skin0.bin`；SHA-256：`b1502e4b935e5248685a6a80f87c373083297db206bfd9a9e518ccf908428af5`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Mordekaiser_Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/TFT13_Mordekaiser_Attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Mordekaiser_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/TFT13_Mordekaiser_Attack2.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Mordekaiser_Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/TFT13_Mordekaiser_Attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Mordekaiser_Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/TFT13_Mordekaiser_Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `TFT13_Mordekaiser_Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/TFT13_Mordekaiser_Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Dance_New.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/Dance_New.TFT_Set13.anm` |
| 未知 | `46fe23f6` | Atomic | `TFT13_Mordekaiser_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/TFT13_Mordekaiser_Spell.TFT_Set13.anm` |
| 未知 | `45fe2263` | Atomic | `TFT13_Mordekaiser_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/TFT13_Mordekaiser_Spell.TFT_Set13.anm` |
| Spell | `a96fc6c9` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `fa80ee75` | Atomic | `Empowered_Attack_new.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/Empowered_Attack_new.TFT_Set13.anm` |
| knockup | `297cd14a` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Spell3Star | `be40c83e` | Atomic | `TFT13_Mordekaiser_Spell3Star.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Mordekaiser/Skins/Base/Animations/TFT13_Mordekaiser_Spell3Star.TFT_Set13.anm` |

## rumble

cast：tft13_rumble_spell；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_rumble/skins/skin0.bin`；SHA-256：`b0de8c80da2cd35b0f82695e29d8a470fc3071bba5778ec515bdd354733d989a`
- 源：`data/characters/tft13_rumble/skins/root.bin`；SHA-256：`387196c43720ee9694ea2448b3de8cb89151179e0dac0102756a9339a86b8624`
- 源：`characters/tft13_rumble`；SHA-256：`6a8476629a99903c3e659e979c02f9362eff834266f795c3cab0345c23c9e2fc`
- 源：`data/characters/tft13_rumble/animations/skin0.bin`；SHA-256：`ab932befe015697defe6d770a01db5bab8aa4a04f5e0ab8d76e5ab347bc4f0cd`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `TFT13_Rumble_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/TFT13_Rumble_attack1.TFT_Set13.anm` |
| Attack2 | `59b1eddd` | Atomic | `TFT13_Rumble_attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/TFT13_Rumble_attack1.TFT_Set13.anm` |
| Crit | `9654058d` | Atomic | `TFT13_Rumble_attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/TFT13_Rumble_attack2.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Rumble_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/Rumble_death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `TFT13_Rumble_run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/TFT13_Rumble_run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Rumble_idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/Rumble_idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Rumble_dance.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/Rumble_dance.TFT_Set13.anm` |
| Upgrade | `dc97cc77` | Atomic | `TFT13_Rumble_Upgrade.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/TFT13_Rumble_Upgrade.TFT_Set13.anm` |
| Spell | `a96fc6c9` | Atomic | `TFT13_Rumble_Spell.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/TFT13_Rumble_Spell.TFT_Set13.anm` |
| 未知 | `3a495dde` | Atomic | `TFT13_Rumble_Spell2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/TFT13_Rumble_Spell2.TFT_Set13.anm` |
| 未知 | `38495ab8` | Atomic | `TFT13_Rumble_Spell2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/TFT13_Rumble_Spell2.TFT_Set13.anm` |
| 未知 | `3b495f71` | Atomic | `TFT13_Rumble_Spell2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/TFT13_Rumble_Spell2.TFT_Set13.anm` |
| 未知 | `9be0b0fa` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| knockup | `297cd14a` | Atomic | `Rumble_death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Rumble/Skins/Base/Animations/Rumble_death.TFT_Set13.anm` |
| 未知 | `b08323df` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |

## sevika（原缺 cast）

cast：spell1_activate；hit：源数据无此动作 / missing-atomic-action。

- 源：`data/characters/tft13_lieutenant/skins/skin0.bin`；SHA-256：`fa760966339f58c502927726008d0bffa278322394c7f0fc0b0fc7404b5fa4a6`
- 源：`data/characters/tft13_lieutenant/skins/root.bin`；SHA-256：`9a88680a67e9347b8274f4e79bf80ebf0d48211cb0868e4a4754962f2a4e4df6`
- 源：`characters/tft13_lieutenant`；SHA-256：`13e436031857613f8230b0244b20ba7dbd42166ed81e93a17427a365671ebdae`
- 源：`data/characters/tft13_lieutenant/animations/skin0.bin`；SHA-256：`f728ddef409a6b86c5750114f443ee6fe4a8a9911a7a13cf3db58a704d34b6b0`

| 图键候选 | key hash | 类型 | 文件 clip 名 | .anm 路径（原值） |
| --- | --- | --- | --- | --- |
| Attack1 | `56b1e924` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| Death | `bd28bd4d` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Death.TFT_Set13.anm` |
| Run | `2acd4eca` | Atomic | `Run.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Run.TFT_Set13.anm` |
| Idle1 | `9dd9dc06` | Atomic | `Idle1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Idle1.TFT_Set13.anm` |
| Celebration | `79d6555f` | Atomic | `Celebration1.TFT_Set13_Evolved.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Celebration1.TFT_Set13_Evolved.anm` |
| attack1_loop | `80c6a1cf` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| 未知 | `0b59cad6` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Attack2 | `59b1eddd` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| attack2_loop | `2afa66dc` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| 未知 | `93a9b5d2` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| death_loop | `36fa7cec` | Atomic | `Death.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Death.TFT_Set13.anm` |
| attack1_end | `55c93006` | Atomic | `Attack1.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Attack1.TFT_Set13.anm` |
| attack2_end | `dfcb6303` | Atomic | `Attack2.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Attack2.TFT_Set13.anm` |
| spell1_start | `0ff3e8cf` | Atomic | `Spell1_Activate.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell1_Activate.TFT_Set13.anm` |
| Spell1_Loop | `6c76df5b` | Atomic | `Spell1_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell1_Loop.TFT_Set13.anm` |
| Spell1 | `b2f63868` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| Spell2 | `b5f63d21` | Atomic | `Spell2_Punch.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell2_Punch.TFT_Set13.anm` |
| Spell2_Dash | `35dde45a` | Atomic | `Spell2_Dash.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell2_Dash.TFT_Set13.anm` |
| Spell3 | `b4f63b8e` | Atomic | `Spell3.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell3.TFT_Set13.anm` |
| spell4_start | `aac15fb4` | Atomic | `Spell4_Activate.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell4_Activate.TFT_Set13.anm` |
| Spell4_Loop | `a98dac96` | Atomic | `Spell4_Loop.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell4_Loop.TFT_Set13.anm` |
| Spell2_Slam | `a88e7e33` | Atomic | `Spell2_Slam.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell2_Slam.TFT_Set13.anm` |
| ReRoll | `0724b3ab` | Atomic | `Spell1_ReRoll.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell1_ReRoll.TFT_Set13.anm` |
| Spell4 | `b7f64047` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `066497ba` | Atomic | `Spell2_Slam.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell2_Slam.TFT_Set13.anm` |
| spell3_loop | `8c097dd1` | Atomic | `Spell3.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell3.TFT_Set13.anm` |
| 未知 | `e7d2395f` | 非 Atomic 0x8d30a7c0 | 无直接 ANM | — |
| 未知 | `24e9da04` | Atomic | `Spell2_Dash.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell2_Dash.TFT_Set13.anm` |
| 未知 | `14853f51` | Atomic | `Spell2_Slam.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell2_Slam.TFT_Set13.anm` |
| 未知 | `f32c8d3c` | Atomic | `Spell3.TFT_Set13.anm` | `ASSETS/Characters/TFT13_Lieutenant/Skins/Base/Animations/Spell3.TFT_Set13.anm` |

