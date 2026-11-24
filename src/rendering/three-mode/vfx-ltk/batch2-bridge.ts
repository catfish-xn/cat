import { jayceForgeSource } from './sustain-stops';
import type { DisplayCombatEvent } from '../../../presentation/combat-display';
import type { BoardFrame } from '../../board-feed';
import type { LtkPlayOptions } from './runtime';
import type { TimelineVariant, WorldPoint } from './timeline';
import { CUE_RULE_STOPS, VI_HAND_TRAIL } from './cue-overrides';
import { jayceSkill } from './champions/jayce';
import { SEVIKA_SLOT_SECONDS, sevikaSkill, sevikaSlotSkills } from './champions/sevika';
import { melSkill } from './champions/mel';

interface Unit { definitionId: string; form: 'front' | 'back'; starLevel: number; alive: boolean; disposed?: boolean }
type Cast = Extract<DisplayCombatEvent, { type: 'cast' }>;
type Outcome = Extract<DisplayCombatEvent, { type: 'castOutcome' }>;
interface Host {
  unit(id: string): Unit | undefined;
  board(): Pick<BoardFrame, 'columns' | 'rows' | 'hexRadius' | 'origin'> | null;
  play(champion: string, source: string, targets: readonly string[], action: 'cast' | 'attack' | 'passive', context: LtkPlayOptions): boolean;
  /** Ends the source's runs of these systems (cue-overrides.ts CUE_RULE_STOPS); absent where nothing runs them. */
  stopSystems?(source: string, systems: readonly string[]): void;
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
  // Mel's casts by caster, then action: whether it is her third cast (its own bolts, hits and explosion), and the targets a
  // bolt of it has landed on (a plain cast's hit plays once per target, on its first bolt). Her latest two casts are kept,
  // enough for bolts still flying from one cast when the next begins.
  const melCasts = new Map<string, Map<number, { third: boolean; struck: Set<string> }>>();
  // Mel casters whose cast has begun and whose bolts have not left yet: their next movement is that cast's dash landing.
  // The value: that cast is her third, which has no dash (the rules move her on her plain casts only).
  const melDashing = new Map<string, boolean>();
  // Attackers whose shot the rules launched in this batch (attackLaunched): Gangplank's ranged shot is drawn from those events.
  const launchers = new Set<string>();
  // Vi casters' grabbed target (the cast's first target), for her slam; and the tick each slam was drawn on (one per tick).
  const viTargets = new Map<string, string>();
  const viSlamTicks = new Map<string, number>();
  // Warwicks whose frenzy runs (the rules' bloodFrenzyChanged), with the frenzied attacks drawn so far: their strikes take turns.
  const frenzied = new Map<string, number>();
  // The timeline variant of the attack being played (Warwick's frenzy strikes); only attack plays carry it.
  let variant: TimelineVariant | undefined;
  // The swing's release timing (AttackRelease) for the attack being played; only attack plays carry it.
  let release: LtkPlayOptions['release'];
  // The attack being played crits (LtkPlayOptions.crit); only attack plays carry it.
  let crit = false;
  // The rule branch of the cast being played (cast.branch.branch); a branched cue plays only with its own branch.
  let branch: string | undefined;
  const play = (champion: string, source: string, targets: readonly string[], skill: string, action: 'cast' | 'attack' = 'cast', snapshotTargets = false, channelSeconds?: number, boardOnly = false, delay?: number) =>
    host.play(champion, source, targets, action, { skill, board: batch2BoardPoint(host.board()), snapshotTargets, channelSeconds, boardOnly, persistAcrossPhase: skill === 'mel-save', ...(delay ? { delay, cancelWithSource: true } : {}),
      ...(action === 'attack' && release ? { release } : {}), ...(action === 'attack' && crit ? { crit } : {}), ...(action === 'attack' && variant ? { variant } : {}), ...(action === 'cast' && branch ? { branch } : {}) });
  const bridge = {
    branch(cast: Cast): string | undefined {
      // The rule's own branch output (cast event `branch`) wins; Sevika's roll still comes from her castOutcome.
      if (cast.branch) return cast.branch.branch;
      const outcome = outcomes.get(`${cast.sourceId}:${cast.actionSeq}`);
      if (!outcome?.castVariant || host.unit(cast.sourceId)?.definitionId !== 'sevika') return;
      return outcome.outcome === 'jackpot' ? 'four' : ({ flamethrower: 'one', punch: 'two', chomp: 'three' } as Record<string,string>)[outcome.castVariant.move];
    },
    begin(events: readonly DisplayCombatEvent[]) {
      outcomes.clear(); consequences.clear(); attacks.clear(); launchers.clear();
      events.forEach((event, at) => {
        if (event.type === 'attackLaunched') launchers.add(event.attackerId);
        if (event.type === 'castOutcome' && event.castVariant) outcomes.set(`${event.unitId}:${event.castVariant.actionSeq}`, event);
        if (event.type === 'attack') attacks.add(`${event.attackerId}:${event.tick}`);
        if (event.type !== 'cast') return;
        let end = at + 1;
        while (end < events.length && events[end].type !== 'cast' && events[end].type !== 'attack') end++;
        consequences.set(`${event.sourceId}:${event.actionSeq}`, events.slice(at + 1, end));
      });
    },
    /** `timing`: the attack's release mapping (LtkPlayOptions.release) when the mixer retimed this swing; `critical`: the attack
     * crits (LtkPlayOptions.crit). Casts ignore both. */
    action(action: 'cast' | 'attack', source: string, targets: readonly string[], cast?: Cast, timing?: LtkPlayOptions['release'], critical = false): boolean | undefined {
      release = action === 'attack' ? timing : undefined;
      crit = action === 'attack' && critical;
      branch = action === 'cast' ? cast?.branch?.branch : undefined;
      try { return bridge.dispatch(action, source, targets, cast); } finally { release = undefined; branch = undefined; crit = false; }
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
          if (unit.form === 'back' && recipients.length) play(champion, jayceForgeSource(source), recipients, 'jayce-forge-back');
        }
        return handled;
      }
      // Gangplank's ranged-form attack: the rules launch and land it (attackLaunched / attackLanded), and event() draws the shot
      // and its hit from those, so the attack itself plays nothing more. An attack the rules settle at once (his melee form) has
      // no launch and plays his own list, as does his cast.
      if (champion === 'gangplank' && action === 'attack' && launchers.has(source)) return true;
      if (champion === 'jinx') return play(champion, source, targets, 'jinx', action);
      if (champion === 'mel') return play(champion, source, targets, melSkill(cast?.branch?.branch), action);
      if (champion === 'warwick') {
        const drawn = action === 'attack' ? frenzied.get(source) : undefined;
        if (drawn !== undefined) { variant = drawn % 2 ? 'empowered-alt' : 'empowered'; frenzied.set(source, drawn + 1); }
        try { return play(champion, source, targets, 'warwick', action); } finally { variant = undefined; }
      }
      if (champion === 'viktor') return play(champion, source, targets, 'viktor', action);
    },
    event(event: DisplayCombatEvent, current: boolean) {
      // Gangplank's ranged shot (CUE_EXTRA_SKILLS gangplank-ranged-flight / -land): it leaves on the rules' launch and flies
      // their own flight, arrivalTick − tick at 50 ms a tick, so it lands on the tick his damage does; the hit plays on a
      // landing that hit. One that lands on a target already gone plays no hit (its damage never comes either).
      if (current && (event.type === 'attackLaunched' || event.type === 'attackLanded') && host.unit(event.attackerId)?.definitionId === 'gangplank') {
        if (event.type === 'attackLaunched' && event.projectile === 'flight')
          host.play('gangplank', event.attackerId, [event.targetId], 'passive', { skill: 'gangplank-ranged-flight', board: batch2BoardPoint(host.board()),
            flightSeconds: Math.max(0, event.arrivalTick - event.tick) * 0.05 });
        if (event.type === 'attackLanded' && event.hit)
          host.play('gangplank', event.attackerId, [event.targetId], 'passive', { skill: 'gangplank-ranged-land', board: batch2BoardPoint(host.board()) });
      }
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
          // The slam lands: the board-wide warning, if still up, goes now.
          host.stopSystems?.(event.sourceId, CUE_RULE_STOPS.viktorSlamLanded.systems);
          if (current) {
            const targets = storm.targets.filter(id => { const unit = host.unit(id); return unit?.alive && !unit.disposed; });
            // Caster death does not drop the board point or surviving target hits.
            play('viktor', event.sourceId, targets, storm.star >= 3 ? 'viktor-slam-3star' : 'viktor-slam', 'cast', false, undefined, !targets.length);
          }
        }
      }
      // Mel (rules 'mel-barrage'): her dash lands, then her bolts leave and land, each reported by the rules; observed in
      // catch-up too, so a later bolt still knows its cast.
      if (event.type === 'cast' && host.unit(event.sourceId)?.definitionId === 'mel') {
        const casts = melCasts.get(event.sourceId) ?? new Map<number, { third: boolean; struck: Set<string> }>();
        casts.set(event.actionSeq, { third: event.branch?.branch === 'third', struck: new Set() });
        for (const seq of [...casts.keys()].slice(0, -2)) casts.delete(seq);
        melCasts.set(event.sourceId, casts); melDashing.set(event.sourceId, event.branch?.branch === 'third');
      }
      const melDash = event.type === 'movement' && melDashing.get(event.unitId) === false;
      if (event.type === 'movement') melDashing.delete(event.unitId);
      // Her plain cast fires several bolts at each target, each its own rule projectile ('mel-bolt', 11-21); her third cast's
      // beams are 'mel-barrage'.
      const melBolt = (event.type === 'abilityProjectileLaunched' || event.type === 'abilityProjectileLanded')
        && (event.skill === 'mel-barrage' || event.skill === 'mel-bolt');
      if (melBolt && event.type === 'abilityProjectileLaunched') melDashing.delete(event.sourceId);
      // A frenzy is observed in catch-up too: an attack drawn later in it is still frenzied.
      if (event.type === 'bloodFrenzyChanged' && host.unit(event.unitId)?.definitionId === 'warwick') {
        if (event.active) { if (!frenzied.has(event.unitId)) frenzied.set(event.unitId, 0); } else frenzied.delete(event.unitId);
      }
      // Each cast of hers starts a fresh slam: a replay that starts over (castcmp's warm pass, a rewind) brings her slam on the
      // same tick again, and must draw it again.
      if (event.type === 'cast' && host.unit(event.sourceId)?.definitionId === 'vi') {
        viSlamTicks.delete(event.sourceId);
        if (event.targetIds[0]) viTargets.set(event.sourceId, event.targetIds[0]);
      }
      // Vi's slam lands (g22ViSlam: her skill's own damage, never on her cast tick): once per tick, observed in catch-up too.
      const viSlam = event.type === 'packetDamage' && event.sourceKind === 'ability' && event.delivery === 'ability-direct' && event.definitionId === 'vi-ability'
        && host.unit(event.sourceId)?.definitionId === 'vi' && viSlamTicks.get(event.sourceId) !== event.tick;
      if (viSlam) viSlamTicks.set(event.sourceId, event.tick);
      if (!current) return;
      if (melDash) play('mel', event.unitId, [], 'mel-dash');
      if (melBolt) {
        const record = melCasts.get(event.sourceId)?.get(event.actionSeq), third = record?.third === true;
        // Each bolt flies the rules' own flight (champions/mel.ts MEL_BOLT_FLIGHT) from where she stands as it leaves: one
        // small arc per bolt of her plain cast.
        if (event.type === 'abilityProjectileLaunched') play('mel', event.sourceId, [event.targetId], third ? 'mel-third-bolt' : 'mel-bolt');
        // Its hit when it lands on a target still there (a bolt whose target died in flight lands on nothing). A plain cast's
        // hit plays once per target, as its first bolt lands; its later bolts land with their arcs only (self-chosen: a hit
        // for every bolt would crowd the board: self-chosen, not original, for the on-screen cap; a known-difference candidate, Fable 11-21).
        const firstOnTarget = third || !record || !record.struck.has(event.targetId);
        if (event.type === 'abilityProjectileLanded' && event.hit && firstOnTarget) {
          record?.struck.add(event.targetId);
          play('mel', event.sourceId, [event.targetId], third ? 'mel-third-hit' : 'mel-bolt-hit', 'cast', true);
          // The third cast's explosion, on its main target (the first bolt's, the enemy nearest where she landed).
          if (third && event.ordinal === 0) play('mel', event.sourceId, [event.targetId], 'mel-third-blast', 'cast', true);
        }
      }
      if (viSlam) {
        // Her right hand's trail ends as she lands; her landing group plays there, on her grabbed target (its place, should
        // it have died while held), else on the enemy this damage struck.
        host.stopSystems?.(event.sourceId, [VI_HAND_TRAIL]);
        play('vi', event.sourceId, [viTargets.get(event.sourceId) ?? event.targetId], 'vi-slam', 'cast', true);
      }
      if (event.type === 'devoured' && host.unit(event.unitId)?.definitionId === 'warwick') play('warwick', event.unitId, [event.targetId], 'warwick-devour', 'cast', true);
      if (event.type === 'bloodFrenzyChanged' && event.active && event.permanent) play('warwick', event.unitId, [], 'warwick-permanent');
      // Mel's energy gain plays nothing: its stack visual drew a flat disc at her feet on our board. Held off as a known
      // difference (Fable 11-21).
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
    clear() { outcomes.clear(); consequences.clear(); attacks.clear(); storms.clear(); frenzied.clear(); melCasts.clear(); melDashing.clear(); viTargets.clear(); viSlamTicks.clear(); },
  };
  return bridge;
}
