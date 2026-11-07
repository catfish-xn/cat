import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { canonicalContent, CONTENT_DIGEST } from '../src/simulation/content';
import { LOOT_REPLAY_DIGEST } from '../src/simulation/loot-freeze';
import { createMatch, deployMatchUnit, nextRound, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { serializeMatch } from '../src/simulation/serialization';
import { BattleHistory } from '../src/replay/history';
import { recordCommand } from './fixtures/recorded-empty-route';
import { accepted, fieldBench, reachRound, resolveM5Choices } from './match-helpers';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
/** Diagnostic reverse substitution only. The original strict baseline tests stay
 * unchanged and still fail. Never remove non-null entitlement or gameplay data. */
function priorBytes(text: string, epoch: 'v24' | 'v25'): string {
  return canonicalContent(JSON.parse(text, (key, value) => {
    if (key === 'anomalySelection') { expect(value).toBeNull(); return undefined; }
    if (key === 'rulesVersion') {
      expect(value).toBe('s13-g2-3-v26-neutrals-1424');
      return `s13-g2-3-${epoch}-online-rules`;
    }
    if (key === 'contentVersion') {
      expect(value).toBe('s13-14.24b-g2-3-v26-neutrals-1424');
      return `s13-14.24b-g2-3-${epoch}-online-rules`;
    }
    if (key === 'contentDigest') {
      expect(value).toBe(CONTENT_DIGEST);
      return epoch === 'v24' ? 'fnv1a32-utf16:db662e0b' : 'fnv1a32-utf16:f671ab88';
    }
    if (key === 'replayDigest') {
      expect(value).toBe(LOOT_REPLAY_DIGEST);
      return epoch === 'v24' ? 'fnv1a32-utf16:18c876b2' : 'fnv1a32-utf16:36ebfac2';
    }
    return value;
  }));
}

/** v26-neutrals-1424 drift of the seed-42 1-2 battle, bisected from e9384c02 (see docs/V26_EPOCH_REPORT.md):
 * the 14.24 neutrals restore (795ca7f9, 568eeea4) changes the two melee minions' stats, so the battle now
 * lasts 274 ticks instead of 164 (m01@156/m02@274, 155 events); melee pathing (c64a756a) then adds the
 * player's held `meleeApproach`/`targetEngaged` facts and m01 dies at 155 (153 events). Only these
 * first-battle outcome paths moved; they are pinned exactly here, and everything else must still equal
 * the archived v25 bytes after only the epoch/null-field substitution. */
type Save = { combat: unknown; m8: { loot: { earnedEvidence: { death: unknown }[] } };
  roundResults: { baseDamage: unknown; combatEventCount: unknown; combatTicks: unknown }[] };
const firstBattleOutcome = (save: Save) => ({ combat: save.combat, deaths: save.m8.loot.earnedEvidence.map(e => e.death),
  result: { baseDamage: save.roundResults[0].baseDamage, combatEventCount: save.roundResults[0].combatEventCount,
    combatTicks: save.roundResults[0].combatTicks } });

it('pre-Spoils has only epoch identities and the new null entitlement field changed', () => {
  const history = new BattleHistory('spoils-compatibility');
  let state = fieldBench(resolveM5Choices(createMatch(42)));
  state = accepted(recordCommand(history,state,startMatchCombat(state)));
  while (state.phase === 'combat') state = recordCommand(history,state,stepMatch(state)).state;
  const original = readFileSync(new URL('./fixtures/compat/pre-spoils-v25-seed42.json',import.meta.url),'utf8');
  const current: Save = JSON.parse(serializeMatch(state,history.completedRecords)), archived: Save = JSON.parse(original);
  const outcome = firstBattleOutcome(current);
  expect(outcome.result.combatTicks).toBe(274);
  expect(outcome.deaths).toMatchObject([{ tick: 155 }, { tick: 274 }]);
  expect(sha(canonicalContent(outcome))).toBe('cdf08c521749f0f5124bc9e939b41c2c4e8ac084dd9cccd46e74017b6e9407f9');
  // Splice the archived v25 outcome back into exactly those paths; no other byte may differ.
  current.combat = archived.combat;
  current.m8.loot.earnedEvidence.forEach((evidence, index) => { evidence.death = archived.m8.loot.earnedEvidence[index].death; });
  Object.assign(current.roundResults[0], firstBattleOutcome(archived).result);
  expect(current.m8.loot.earnedEvidence).toHaveLength(archived.m8.loot.earnedEvidence.length);
  expect(priorBytes(JSON.stringify(current),'v25')).toBe(original);
});

it('the four no-owner save hashes recover exactly with only epoch/null-field substitution', () => {
  let state = createMatch(42);
  const hashes: string[] = [];
  const check = () => hashes.push(sha(priorBytes(serializeMatch(state),'v24')));
  check();
  state = accepted(deployMatchUnit(state,state.preparation.units.find(u=>u.team==='player')!.id,{kind:'bench',slot:0})); check();
  state = resolveM5Choices(accepted(startMatchCombat(state))); check();
  state = accepted(nextRound(state,state.round)); check();
  // The two pre-battle saves still recover the v24 hashes exactly. The last two are re-pinned for v26
  // (bisected from e9384c02): the 14.24 neutrals restore (795ca7f9) changes the 1-2 minion stats and this
  // empty-board loss from 3 to 2 HP (baseDamage 3->0, playerDamage/hpLost 3->2); pve-loot-carryover
  // (c684c3ec) then marks the two unearned 1-2 drops `carried` (with an m8.loot.carry entry) instead of
  // `forfeited`. Were 39c02c0190fa9395576008c55fea45ad3b514407363b0c335376174d3b497f2d and
  // 2c29384cb16d144c3036b460ed03093634c8ac0fc4ff5a2b29d56915ea350692.
  expect(hashes).toEqual(['b2241cbf3f5f15734341fbf8ed2f1de589ab77a8ff4b53cffd8b194ad0510e31','318c884b3bc964bb0c225eabc73ed58b665078266ca5f7b3519f714deb7a814f','5ca5b2a467d8437dd6712b6f51e7d4fc0d6485f4a1a1bac9a47ecc0bdbca5456','cbf23d17bd2ae3bb6de517ff9cf5996a2ecf47f7f9529073c54ce98d5a55b01c']);
});

it('the full first-battle terminal save and ledger recover the independent baseline exactly', () => {
  const started = startMatchCombat(createMatch(42));
  let state = accepted(started);
  const events = [...(started.ok ? started.events : [])];
  while (state.phase === 'combat') { const step = stepMatch(state); state = step.state; events.push(...step.events); }
  // v26 re-pin of the approved first-battle drift (see firstBattleOutcome above): 164 ticks/113 events at
  // e9384c02 -> 274/155 after the 14.24 neutrals restore (795ca7f9) -> 274/153 after melee pathing (c64a756a).
  // Was 0039c483da70364e45f0758d45caa5f28374b148740ee3409d0a1de315ff0324 (events) and
  // 99174cbf08013d1ee651990be6036b6ab0ddba8a6a4f1cd5660acd35decee431 (save).
  expect(state.combat!.tick).toBe(274); expect(events).toHaveLength(153);
  expect(sha(canonicalContent(events))).toBe('536cc14b0a3d4245d616eef7a92bb33769fca3e5ea2228c56bdb17cb508ddb83');
  expect(sha(priorBytes(serializeMatch(state),'v24'))).toBe('fc3de4605395549c665e4cbbb9a2f50fee4d9bd97806f8f6320bbe2c87ac6c8f');
});

it('Void Swarm retains its complete historical save bytes after only epoch/null-field substitution', () => {
  // v26 re-pin: d5-register (3ce71065, four augment registrations and stage bans) changes seed 53's
  // 2-1 offer to wandering-trainer-ii/dual-purpose/sorcerer-crown with the same choice RNG, gold and HP.
  // Seed 57 is the first seed whose public 2-1 offer includes Void Swarm under the current rules.
  // Its hash is therefore a v26 pin, not the archived v25 value 8dedd866...8178d (seed 53).
  const open = reachRound('2-1',false,57);
  expect(open.pendingChoice!.offers).toContain('void-swarm');
  let state: MatchState = resolveM5Choices(open,['void-swarm']);
  state = accepted(deployMatchUnit(state,state.preparation.units.find(u=>u.team==='player')!.id,{kind:'board',cell:{col:3,row:4}}));
  state = accepted(startMatchCombat(state));
  expect(sha(priorBytes(serializeMatch(state),'v25'))).toBe('f0cb869ebbea3d2d9e183797edcf637b25a1c51896ea153633ef435ca2f97d47');
});
