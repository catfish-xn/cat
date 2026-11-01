import { describe, expect, it } from 'vitest';
import { M8_VERSION } from '../src/simulation/m8/version';
import { createMatch, equipItem, nextRound, rerollAugment, selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';
import type { BattleRecord, SaveEnvelope } from '../src/m6/contracts';
import { BattleHistory, validateBattleCollection } from '../src/replay';
import { exportFile, validateFile } from '../src/persistence/format';
import { coldBattleReplayCount } from '../src/simulation/battle-record-validation';
import { augmentNeedsHistory } from '../src/simulation/augment-history-owners';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { accepted, resolveM5Choices } from './match-helpers';

const blob = (text: string) => new Blob([text]);

function envelopeWithInCombatEquip(seed: number): SaveEnvelope {
  const runId = `security-equip-${seed}`;
  const history = new BattleHistory(runId);
  let match = createMatch(seed);
  let equipped = 0;
  const combatEvents = (events: readonly { domain?: string }[]) => events.filter((event): event is LedgerCombatEvent => event.domain === 'combat');
  const resolve = (state: MatchState) => {
    let guard = 0;
    while (state.phase === 'choice' && guard++ < 12) {
      const choice = state.pendingChoice;
      if (choice?.kind === 'augment') {
        const owned = choice.offers.find(id => augmentNeedsHistory(id));
        if (owned) { state = accepted(selectChoice(state, choice.choiceId, choice.generation, owned)); continue; }
        const slot = choice.rerolledSlots?.findIndex(used => !used) ?? -1;
        if (slot >= 0) { state = accepted(rerollAugment(state, choice.choiceId, choice.generation, slot)); continue; }
      }
      state = resolveM5Choices(state);
    }
    return state;
  };
  const stop = getCatalogRoundById('4-2').ordinal;
  for (let guard = 0; guard < 120 && match.round <= stop && (!match.augmentHistory || history.completedRecords.length < 1 || !equipped); guard++) {
    if (match.phase === 'gameOver') break;
    if (match.phase === 'choice') { match = resolve(match); continue; }
    if (match.phase === 'settlement') {
      const before = match;
      const advanced = nextRound(match, match.round);
      if (!advanced.ok) break;
      match = advanced.state;
      history.observe({ before, after: match, events: combatEvents(advanced.events), reason: 'command' });
      continue;
    }
    if (match.phase !== 'preparation') break;
    const before = match;
    const started = startMatchCombat(match);
    if (!started.ok) break;
    match = started.state;
    history.observe({ before, after: match, events: combatEvents(started.events), reason: 'command' });
    let ticks = 0;
    while (match.phase === 'combat') {
      if (match.augmentHistory && ticks === 2 && !equipped) {
        for (const item of match.items.filter(i => i.location.kind === 'inventory')) {
          for (const unit of match.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board')) {
            for (let slot = 0; slot < 3; slot++) {
              const result = equipItem(match, item.id, unit.id, slot);
              if (result.ok) {
                const tickBefore = match;
                match = result.state;
                history.observe({ before: tickBefore, after: match, events: combatEvents(result.events), reason: 'command' });
                equipped++;
                break;
              }
            }
            if (equipped) break;
          }
          if (equipped) break;
        }
      }
      const tickBefore = match;
      const stepped = stepMatch(match);
      match = stepped.state;
      ticks++;
      history.observe({ before: tickBefore, after: match, events: combatEvents(stepped.events), reason: 'tick' });
    }
  }
  if (!match.augmentHistory || history.completedRecords.length < 1 || !equipped) {
    throw new Error(`seed ${seed} did not produce an in-combat equip battle`);
  }
  return {
    kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
    runId, createdAt: '2026-10-06T00:00:00.000Z', match, battles: history.completedRecords, currentBattle: null,
  };
}

function findPrefixBattle(envelope: SaveEnvelope): BattleRecord {
  const record = envelope.battles.find(battle => battle.context.augmentHistory && !Array.isArray(battle.context.augmentHistory.facts));
  if (!record) throw new Error('no compact augment-history battle in fixture');
  return record;
}

describe('import rejects forged combat equipment evidence', () => {
  it('rejects a save that omits equipmentCommands while the match proof equipped in combat', async () => {
    let envelope: SaveEnvelope | null = null;
    for (const seed of [902431, 902432, 902433, 902434, 902435, 11, 12, 13]) {
      try { envelope = envelopeWithInCombatEquip(seed); break; } catch { /* try next seed */ }
    }
    if (!envelope) throw new Error('no in-combat equip scenario');
    const index = envelope.battles.findIndex(battle => battle.equipmentCommands?.length);
    expect(index).toBeGreaterThanOrEqual(0);
    await validateFile(blob(JSON.stringify(envelope)), validateBattleCollection);
    const coldBeforeForged = coldBattleReplayCount();
    const forged = JSON.parse(JSON.stringify(envelope)) as SaveEnvelope;
    delete (forged.battles[index] as BattleRecord & { equipmentCommands?: unknown }).equipmentCommands;
    await expect(validateFile(blob(JSON.stringify(forged)), validateBattleCollection)).rejects.toThrow(/穿戴|事件缺失|战斗档案无效/);
    expect(coldBattleReplayCount()).toBeGreaterThan(coldBeforeForged);
  });
});

describe('import rejects status dictionary amplification', () => {
  it('rejects nested statusRef bombs quickly without expanding the dictionary', async () => {
    const envelope = envelopeWithInCombatEquip(902431);
    const compact = await exportFile(envelope).text();
    const parsed = JSON.parse(compact) as { battles: unknown[] };
    const template = findPrefixBattle(JSON.parse(compact) as SaveEnvelope);
    const entryKB = 64;
    const refs = 2000;
    const battleIndex = parsed.battles.findIndex(battle => (battle as { combatId?: string }).combatId === template.combatId);
    const tampered = JSON.parse(JSON.stringify(template)) as Record<string, unknown>;
    tampered.statusDictionary = [{ s: 'x'.repeat(entryKB * 1024) }];
    const events = tampered.events as Record<string, unknown>[];
    events[0] = { ...events[0], pad: Array.from({ length: refs }, () => ({ $statusRef: 0 })) };
    parsed.battles[battleIndex >= 0 ? battleIndex : 0] = tampered;
    const text = JSON.stringify(parsed);
    const heapBefore = process.memoryUsage().heapUsed;
    const started = performance.now();
    await expect(validateFile(blob(text), validateBattleCollection)).rejects.toThrow(/状态字典|存档无效/);
    const elapsed = performance.now() - started;
    const heapDelta = process.memoryUsage().heapUsed - heapBefore;
    expect(elapsed).toBeLessThan(5000);
    expect(heapDelta).toBeLessThan(80 * 1024 * 1024);
  });
});
