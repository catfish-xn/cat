import { expect, it } from 'vitest';
import { sniperOpeningAmpBps } from '../src/simulation/augment-pool-batch5-h10-sniper';
import type { AugmentHistory, HistoryRoster, AugmentHistoryFact } from '../src/simulation/augment-history-types';
import type { Unit } from '../src/simulation/unit-types';

const unit = (id: string, col: number | null, definitionId = 'zeri'): Unit => ({ id, definitionId, team: 'player', starLevel: 1,
  location: col === null ? { kind: 'bench', slot: 0 } : { kind: 'board', cell: { col, row: 0 } } });
const roster = (...units: Unit[]): HistoryRoster => ({ units, items: [] });
function history(rows: any[]): AugmentHistory {
  const facts = [{kind:'acquire',choiceId:'pick',definitionId:'snipers-nest',roster:roster()}, ...rows].map((row, sequence) => ({...row,sequence,seatId:'solo',round:row.round ?? sequence + 1,roundId:'round',resourcePrefix:0})) as AugmentHistoryFact[];
  return { version:'augment-history-v1', seatId:'solo', facts, proof:{kind:'server'} };
}
const battle = (round: number, r: HistoryRoster) => ({kind:'combat-roster',battleId:`b${round}`,round,roster:r});
const positions = (round: number, r: HistoryRoster) => ({kind:'positions',round,roster:r});
it('derives first, consecutive, capped, changed-cell and bench-reset opening damage from facts', () => {
 const a = roster(unit('a',1));
 expect(sniperOpeningAmpBps(history([]),'pick',2,a).a).toBe(800);
 const past = [battle(2,a),battle(3,a),battle(4,a),battle(5,a)];
 expect(sniperOpeningAmpBps(history(past),'pick',6,a).a).toBe(3200);
 expect(sniperOpeningAmpBps(history(past),'pick',6,roster(unit('a',2))).a).toBe(800);
 expect(sniperOpeningAmpBps(history([...past,positions(6,roster(unit('a',null)))]),'pick',6,a).a).toBe(800);
 expect(sniperOpeningAmpBps(history(past),'pick',6,roster(unit('replacement',1))).replacement).toBe(800);
});
it('retains the main instance through a merge and does not count a recorded PvP opening twice', () => {
 const a=roster(unit('a',1)), merged=roster({...unit('a',1),starLevel:2});
 const pvp={kind:'pvp-roster',battleId:'b3',round:3,seats:[{...merged,seatId:'solo'}],mirrorOfSeatId:null};
 expect(sniperOpeningAmpBps(history([battle(2,a),positions(3,merged),pvp]),'pick',3,merged).a).toBe(1600);
});
it('requires the actual acquisition evidence', () => {
 expect(()=>sniperOpeningAmpBps(history([]),'other',2,roster(unit('a',1)))).toThrow('missing sniper acquisition');
});
it('freezes this battle before later position facts, but resets absence for the next battle', () => {
 const a=roster(unit('a',1)), off=roster(unit('a',null));
 const past=[battle(2,a),battle(3,a),positions(3,off)];
 expect(sniperOpeningAmpBps(history(past),'pick',3,off).a).toBe(1600);
 expect(sniperOpeningAmpBps(history(past),'pick',4,a).a).toBe(800);
});
it('counts only battles; temporary board moves do not change the opening cell and emblem membership is sampled at opening', () => {
 const a=roster(unit('a',1)), shifted=roster(unit('a',2));
 expect(sniperOpeningAmpBps(history([battle(2,a),positions(3,shifted),positions(4,a)]),'pick',5,a).a).toBe(1600);
 const outsider=roster(unit('a',1,'darius'));
 const emblemed={...outsider,items:[{id:'item-1',definitionId:'TFT13_Item_SniperEmblemItem',location:{kind:'unit' as const,unitId:'a',slot:0}}]};
 expect(sniperOpeningAmpBps(history([]),'pick',2,outsider).a).toBeUndefined();
 expect(sniperOpeningAmpBps(history([]),'pick',2,emblemed).a).toBe(800);
 expect(sniperOpeningAmpBps(history([battle(2,emblemed),battle(3,outsider)]),'pick',4,emblemed).a).toBe(800);
});
