import { freezeContent } from './freeze';
/** Exact local 14.24 zh_cn stringtable entries; display data only. */
export const V19_OFFICIAL_TRAIT_TEXT = freezeContent({
  "form-swapper": {
    "apiName": "TFT13_FormSwapper",
    "locale": "zh_cn",
    "description": "固有能力：【双形战士】们会基于自己所在的位置（前两排或后两排）而更换他们的技能。<br><br>前2排的【双形战士】们将获得伤害减免。后2排的【双形战士】们将获得伤害增幅。<br><br><expandRow>(@MinUnits@) @DR*100@% %i:scaleDR%或@DA*100@% %i:scaleDA%</expandRow>"
  },
  "sisters": {
    "apiName": "TFT13_Teamup_Sisters",
    "locale": "zh_cn",
    "description": "当【金克丝】参与一次击杀后，【蔚】会获得持续@ViDuration@秒的@ADBuff*100@%额外攻击力。当【蔚】参与一次击杀后，【金克丝】会获得持续@JinxDuration@秒的@ASBuff*100@%额外攻速。"
  }
});
export const V19_SISTERS_DISPLAY_SOURCE = freezeContent({sisters:{tiers:[{threshold:2,values:{ADBuff:0.4,ASBuff:0.75,ViDuration:7,JinxDuration:5}}]}});
