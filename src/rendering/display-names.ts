import { UNIT_DEFINITIONS } from '../simulation/units';
import { NEUTRAL_DEFINITIONS } from '../simulation/content/neutrals';
import { g23UnitName } from '../presentation/g23-display';

/** S13 client names (CommunityDragon 14.24 zh_cn.json, checked 2026-10-15). Swain is listed though its form stays blocked. */
const UNIT_ZH: Readonly<Record<string,string>> = {
  tristana:'崔丝塔娜', urgot:'厄加特', ezreal:'伊泽瑞尔', corki:'库奇', irelia:'艾瑞莉娅', rell:'芮尔', leona:'蕾欧娜', loris:'洛里斯',
  maddie:'麦迪', kogmaw:'克格莫', darius:'德莱厄斯', vander:'范德尔', scar:'刀疤', garen:'盖伦', caitlyn:'凯特琳', lux:'拉克丝', zyra:'婕拉', nami:'娜美', zoe:'佐伊',
  amumu:'阿木木', blitzcrank:'布里茨', ekko:'艾克', illaoi:'俄洛伊', leblanc:'乐芙兰', malzahar:'玛尔扎哈', nocturne:'魔腾', powder:'爆爆', rumble:'兰博',
  singed:'辛吉德', swain:'斯维因', twitch:'图奇', violet:'蔚奥莱', vladimir:'弗拉基米尔', zeri:'泽丽',
  akali:'阿卡丽', ambessa:'安蓓萨', camille:'卡蜜尔', draven:'德莱文', heimerdinger:'黑默丁格', jinx:'金克丝', mordekaiser:'莫德凯撒', morgana:'莫甘娜',
  sett:'瑟提', steb:'斯特卜', trundle:'特朗德尔', twistedfate:'崔斯特', vex:'薇古丝', vi:'蔚', ziggs:'吉格斯',
  // v19 six-costs (same ids as the rules layer).
  warwick:'沃里克', viktor:'维克托', mel:'梅尔',
};
export const displayUnitName = (id: string) => UNIT_ZH[id] ?? g23UnitName(id) ?? (Object.hasOwn(NEUTRAL_DEFINITIONS, id) ? NEUTRAL_DEFINITIONS[id].name : undefined) ?? UNIT_DEFINITIONS[id]?.name ?? '未知单位';
