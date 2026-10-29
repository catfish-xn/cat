import type { DisplayCombatEvent } from '../../../presentation/combat-display';
import type { BoardFrame } from '../../board-feed';
import type { LtkPlayOptions } from './runtime';
import type { WorldPoint } from './timeline';
import { jayceSkill } from './champions/jayce';
import { sevikaSkill } from './champions/sevika';
import { melSkill } from './champions/mel';

interface Unit { definitionId: string; form: 'front' | 'back'; starLevel: number; alive: boolean; disposed?: boolean }
type Cast = Extract<DisplayCombatEvent, { type: 'cast' }>;
type Outcome = Extract<DisplayCombatEvent, { type: 'castOutcome' }>;
interface Host {
  unit(id: string): Unit | undefined;
  board(): Pick<BoardFrame, 'columns' | 'rows' | 'hexRadius' | 'origin'> | null;
  play(champion: string, source: string, targets: readonly string[], index: number, action: 'cast' | 'attack', context: LtkPlayOptions): boolean;
}
export function batch2BoardPoint(frame: ReturnType<Host['board']>): WorldPoint | undefined {
  if (!frame) return;
  const row = Math.floor((frame.rows - 1) / 2), col = Math.floor((frame.columns - 1) / 2);
  return [frame.origin.x + Math.sqrt(3) * frame.hexRadius * (col + (row % 2) / 2), 0, frame.origin.y + frame.hexRadius * 1.5 * row];
}
/** No target search, RNG or rule calculation: branches and recipients come from display receipts. */
export function createBatch2VfxBridge(host: Host) {
  const outcomes = new Map<string, Outcome>();
  const consequences = new Map<string, readonly DisplayCombatEvent[]>();
  const storms = new Map<string, { tick: number; targets: readonly string[]; star: number }>();
  const attacks = new Set<string>();
  const energyTicks = new Map<string, number>();
  const play = (champion: string, source: string, targets: readonly string[], skill: string, index = 0, action: 'cast' | 'attack' = 'cast', snapshotTargets = false, channelSeconds?: number, boardOnly = false) =>
    host.play(champion, source, targets, index, action, { skill, board: batch2BoardPoint(host.board()), snapshotTargets, channelSeconds, boardOnly, persistAcrossPhase: skill === 'mel-save' });
  return {
    branch(cast: Cast): string | undefined {
      const outcome = outcomes.get(`${cast.sourceId}:${cast.actionSeq}`);
      if (!outcome?.castVariant || host.unit(cast.sourceId)?.definitionId !== 'sevika') return;
      return outcome.outcome === 'jackpot' ? 'four' : ({ flamethrower: 'one', punch: 'two', chomp: 'three' } as Record<string,string>)[outcome.castVariant.move];
    },
    begin(events: readonly DisplayCombatEvent[]) {
      outcomes.clear(); consequences.clear(); attacks.clear();
      events.forEach((event, at) => {
        if (event.type === 'castOutcome' && event.castVariant) outcomes.set(`${event.unitId}:${event.castVariant.actionSeq}`, event);
        if (event.type === 'attack') attacks.add(`${event.attackerId}:${event.tick}`);
        if (event.type !== 'cast') return;
        let end = at + 1;
        while (end < events.length && events[end].type !== 'cast' && events[end].type !== 'attack') end++;
        consequences.set(`${event.sourceId}:${event.actionSeq}`, events.slice(at + 1, end));
      });
    },
    action(action: 'cast' | 'attack', source: string, targets: readonly string[], index: number, cast?: Cast): boolean | undefined {
      const unit = host.unit(source); if (!unit) return;
      const champion = unit.definitionId;
      if (champion === 'sevika') {
        if (action === 'attack') return play(champion, source, targets, 'sevika', index, action);
        const outcome = cast && outcomes.get(`${source}:${cast.actionSeq}`);
        const skill = outcome?.castVariant && sevikaSkill(outcome.castVariant.move, outcome.outcome);
        if (!skill) return false; // Never guess a random move from the cast count.
        const channel = outcome!.castVariant!.move === 'flamethrower' ? outcome!.castVariant!.channelTicks : 0;
        const handled = play(champion, source, targets, skill, 0, 'cast', false, channel > 0 ? channel * .05 : undefined);
        if (handled && ['jackpot', 'rocket', 'shield', 'coin'].includes(outcome!.outcome)) play(champion, source, targets, `sevika-${outcome!.outcome}`);
        return handled;
      }
      if (champion === 'jayce') {
        const handled = play(champion, source, targets, jayceSkill(unit.form), index, action);
        if (action === 'cast' && cast) {
          const effects = consequences.get(`${source}:${cast.actionSeq}`) ?? [];
          // The action slice is bounded by the next attack/cast. These are actual
          // beneficial status receipts, not a second nearest-allies selection.
          const recipients = effects.filter(e => e.type === 'statusChanged' && e.kind === 'stat-buff' && (e.reason === 'applied' || e.reason === 'refreshed'))
            .flatMap(e => e.type === 'statusChanged' ? [e.targetId] : []);
          if (unit.form === 'back' && recipients.length) play(champion, `${source}:g23-forge`, recipients, 'jayce-forge-back');
        }
        return handled;
      }
      if (champion === 'jinx') return play(champion, source, targets, 'jinx', index, action);
      if (champion === 'mel') return play(champion, source, targets, melSkill(index), index, action);
      if (champion === 'warwick') return play(champion, source, targets, 'warwick', index, action);
      if (champion === 'viktor') return play(champion, source, targets, 'viktor', index, action);
    },
    event(event: DisplayCombatEvent, current: boolean) {
      // Catch-up still observes every cast and landing in order, even when its
      // warning/impact is too old to play. State must not depend on action().
      if (event.type === 'cast') {
        const unit = host.unit(event.sourceId);
        if (unit?.definitionId === 'viktor') storms.set(event.sourceId, { tick: event.tick, targets: event.targetIds, star: unit.starLevel });
      }
      if (event.type === 'packetDamage') {
        const storm = storms.get(event.sourceId);
        // Slam is Viktor's own later ability-direct magic (viktor-ability). Deathfire
        // Grasp and other item pulses share the owner, magic type and target, and
        // must not consume the landing. A same-tick attack stays ambiguous.
        const ownStorm = event.damageType === 'magic' && event.sourceKind === 'ability'
          && event.definitionId === 'viktor-ability' && event.delivery === 'ability-direct';
        if (storm && ownStorm && storm.targets.includes(event.targetId)
          && event.tick > storm.tick && !attacks.has(`${event.sourceId}:${event.tick}`)) {
          storms.delete(event.sourceId);
          if (current) {
            const targets = storm.targets.filter(id => { const unit = host.unit(id); return unit?.alive && !unit.disposed; });
            // Caster death does not drop the board point or surviving target hits.
            play('viktor', event.sourceId, targets, storm.star >= 3 ? 'viktor-slam-3star' : 'viktor-slam', 0, 'cast', false, undefined, !targets.length);
          }
        }
      }
      if (!current) return;
      if (event.type === 'devoured' && host.unit(event.unitId)?.definitionId === 'warwick') play('warwick', event.unitId, [event.targetId], 'warwick-devour', 0, 'cast', true);
      if (event.type === 'bloodFrenzyChanged' && event.active && event.permanent) play('warwick', event.unitId, [], 'warwick-permanent');
      if (event.type === 'melEnergyChanged' && event.after > event.before && energyTicks.get(event.unitId) !== event.tick) {
        energyTicks.set(event.unitId, event.tick); play('mel', event.unitId, [], 'mel-energy');
      }
      if (event.type === 'shieldLayerChanged' && event.reason === 'granted' && event.remaining > 0) {
        try {
          const key: unknown = JSON.parse(event.key);
          if (Array.isArray(key) && key.length === 9 && key[2] === 'ability' && key[7] === event.targetId && typeof key[1] === 'string') {
            if (key[3] === 'mel-ability') play('mel', key[1], [event.targetId], 'mel-shield');
            if (key[3] === 'jayce-ability') play('jayce', key[1], [event.targetId], 'jayce-forge-front');
          }
        } catch { /* An unknown identity is never a recipient guess. */ }
      }
    },
    save(battleId: string) { return play('mel', `@mel-save:${battleId}`, [], 'mel-save'); },
    clear() { outcomes.clear(); consequences.clear(); attacks.clear(); storms.clear(); energyTicks.clear(); },
  };
}
