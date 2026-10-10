import { UNIT_DEFINITIONS } from '../simulation/units';
import { NEUTRAL_DEFINITIONS } from '../simulation/content/neutrals';

const UNIT_ZH: Readonly<Record<string,string>> = {
  tristana:'崔丝塔娜', urgot:'厄加特', ezreal:'伊泽瑞尔', corki:'库奇', irelia:'艾瑞莉娅', rell:'芮尔', leona:'蕾欧娜', loris:'洛里斯',
  maddie:'麦迪', kogmaw:'克格莫', darius:'德莱厄斯', vander:'范德尔', scar:'斯卡', garen:'盖伦', caitlyn:'凯特琳', lux:'拉克丝', zyra:'婕拉', nami:'娜美', zoe:'佐伊',
};
export const displayUnitName = (id: string) => UNIT_ZH[id] ?? (Object.hasOwn(NEUTRAL_DEFINITIONS, id) ? NEUTRAL_DEFINITIONS[id].name : undefined) ?? UNIT_DEFINITIONS[id]?.name ?? '未知单位';
