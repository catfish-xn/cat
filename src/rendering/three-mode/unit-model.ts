/** 14.24 skin0: component uses ArmoryKey_A.skn/.skl, completed uses ArmoryKey_B.skn/.skl.
 * Both use Component/Skins/Base/TFT7_ArmoryKey.tex and Animations/Armory_A_Idle1.anm.
 * Optional GLBs belong under their own manifest.models.TFT_ArmoryKey{Component,Completed} keys.
 * No asset bytes or private filesystem paths belong in this mapping.
 */
export function unitModelId(definitionId: string, anvil: boolean): string | null {
  return anvil && definitionId !== 'TFT_ArmoryKeyComponent' && definitionId !== 'TFT_ArmoryKeyCompleted' ? null : definitionId;
}
