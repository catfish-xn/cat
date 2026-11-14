import type { DisplayCombatEvent } from '../../../presentation/combat-display';
import type { BoardFrame } from '../../board-feed';
import type { LtkPlayOptions } from './runtime';
import type { WorldPoint } from './timeline';
import { jayceSkill } from './champions/jayce';
import { SEVIKA_SLOT_SECONDS, sevikaSkill, sevikaSlotSkills } from './champions/sevika';
import { melSkill } from './champions/mel';

interface Unit { definitionId: string; form: 'front' | 'back'; starLevel: number; alive: boolean; disposed?: boolean }
type Cast = Extract<DisplayCombatEvent, { type: 'cast' }>;
type Outcome = Extract<DisplayCombatEvent, { type: 'castOutcome' }>;
interface Host {
  unit(id: string): Unit | undefined;
  board(): Pick<BoardFrame, 'columns' | 'rows' | 'hexRadius' | 'origin'> | null;
  play(champion: string, source: string, targets: readonly string[], action: 'cast' | 'attack', context: LtkPlayOptions): boolean;
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
  // The swing's release timing (AttackRelease) for the attack being played; only attack plays carry it.
  let release: LtkPlayOptions['release'];
  // The rule branch of the cast being played (cast.branch.branch); a branched cue plays only with its own branch.
  let branch: string | undefined;
  const play = (champion: string, source: string, targets: readonly string[], skill: string, action: 'cast' | 'attack' = 'cast', snapshotTargets = false, channelSeconds?: number, boardOnly = false, delay?: number) =>
    host.play(champion, source, targets, action, { skill, board: batch2BoardPoint(host.board()), snapshotTargets, channelSeconds, boardOnly, persistAcrossPhase: skill === 'mel-save', ...(delay ? { delay, cancelWithSource: true } : {}),
      ...(action === 'attack' && release ? { release } : {}), ...(action === 'cast' && branch ? { branch } : {}) });
  const bridge = {
    branch(cast: Cast): string | undefined {
      // The rule's own branch output (cast event `branch`) wins; Sevika's roll still comes from her castOutcome.
      if (cast.branch) return cast.branch.branch;
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
    /** `timing`: the attack's release mapping (LtkPlayOptions.release) when the mixer retimed this swing; casts ignore it. */
    action(action: 'cast' | 'attack', source: string, targets: readonly string[], cast?: Cast, timing?: LtkPlayOptions['release']): boolean | undefined {
      release = action === 'attack' ? timing : undefined;
      branch = action === 'cast' ? cast?.branch?.branch : undefined;
      try { return bridge.dispatch(action, source, targets, cast); } finally { release = undefined; branch = undefined; }
    },
    dispatch(action: 'cast' | 'attack', source: string, targets: readonly string[], cast?: Cast): boolean | undefined {
      const unit = host.unit(source); if (!unit) return;
      const champion = unit.definitionId;
      if (champion === 'sevika') {
        if (action === 'attack') return play(champion, source, targets, 'sevika', action);
        const outcome = cast && outcomes.get(`${source}:${cast.actionSeq}`);
        const skill = outcome?.castVariant && sevikaSkill(outcome.castVariant.move, outcome.outcome);
        if (!skill) return false; // Never guess a random move from the cast count.
        const channel = outcome!.castVariant!.move === 'flamethrower' ? outcome!.castVariant!.channelTicks : 0;
        // The rolled spell and its mod land when the slot machine stops, as the rules do.
        const handled = play(champion, source, targets, skill, 'cast', false, channel > 0 ? channel * .05 : undefined, false, SEVIKA_SLOT_SECONDS);
        if (handled && ['rocket', 'shield', 'coin'].includes(outcome!.outcome)) play(champion, source, targets, `sevika-${outcome!.outcome}`, 'cast', false, undefined, false, SEVIKA_SLOT_SECONDS);
        // The slot machine is decoration over the cast: a catalogue without it keeps the cast as it was.
        if (handled) for (const slot of sevikaSlotSkills(outcome!.castVariant!.move, outcome!.outcome)) play(champion, source, targets, slot);
        return handled;
      }
      if (champion === 'jayce') {
        const handled = play(champion, source, targets, jayceSkill(unit.form), action);
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
      if (champion === 'jinx') return play(champion, source, targets, 'jinx', action);
      if (champion === 'mel') return play(champion, source, targets, melSkill(cast?.branch?.branch), action);
      if (champion === 'warwick') return play(champion, source, targets, 'warwick', action);
      if (champion === 'viktor') return play(champion, source, targets, 'viktor', action);
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
            play('viktor', event.sourceId, targets, storm.star >= 3 ? 'viktor-slam-3star' : 'viktor-slam', 'cast', false, undefined, !targets.length);
          }
        }
      }
      if (!current) return;
      if (event.type === 'devoured' && host.unit(event.unitId)?.definitionId === 'warwick') play('warwick', event.unitId, [event.targetId], 'warwick-devour', 'cast', true);
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
  return bridge;
}
