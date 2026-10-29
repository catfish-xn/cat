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
      expect(value).toBe('s13-g2-3-v26-online-rules');
      return `s13-g2-3-${epoch}-online-rules`;
    }
    if (key === 'contentVersion') {
      expect(value).toBe('s13-14.24b-g2-3-v26-online-rules');
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

it('pre-Spoils has only epoch identities and the new null entitlement field changed', () => {
  const history = new BattleHistory('spoils-compatibility');
  let state = fieldBench(resolveM5Choices(createMatch(42)));
  state = accepted(recordCommand(history,state,startMatchCombat(state)));
  while (state.phase === 'combat') state = recordCommand(history,state,stepMatch(state)).state;
  const original = readFileSync(new URL('./fixtures/compat/pre-spoils-v25-seed42.json',import.meta.url),'utf8');
  expect(priorBytes(serializeMatch(state,history.completedRecords),'v25')).toBe(original);
});

it('the four no-owner save hashes recover exactly with only epoch/null-field substitution', () => {
  let state = createMatch(42);
  const hashes: string[] = [];
  const check = () => hashes.push(sha(priorBytes(serializeMatch(state),'v24')));
  check();
  state = accepted(deployMatchUnit(state,state.preparation.units.find(u=>u.team==='player')!.id,{kind:'bench',slot:0})); check();
  state = resolveM5Choices(accepted(startMatchCombat(state))); check();
  state = accepted(nextRound(state,state.round)); check();
  expect(hashes).toEqual(['b2241cbf3f5f15734341fbf8ed2f1de589ab77a8ff4b53cffd8b194ad0510e31','318c884b3bc964bb0c225eabc73ed58b665078266ca5f7b3519f714deb7a814f','39c02c0190fa9395576008c55fea45ad3b514407363b0c335376174d3b497f2d','2c29384cb16d144c3036b460ed03093634c8ac0fc4ff5a2b29d56915ea350692']);
});

it('the full first-battle terminal save and ledger recover the independent baseline exactly', () => {
  const started = startMatchCombat(createMatch(42));
  let state = accepted(started);
  const events = [...(started.ok ? started.events : [])];
  while (state.phase === 'combat') { const step = stepMatch(state); state = step.state; events.push(...step.events); }
  expect(state.combat!.tick).toBe(164); expect(events).toHaveLength(113);
  expect(sha(canonicalContent(events))).toBe('0039c483da70364e45f0758d45caa5f28374b148740ee3409d0a1de315ff0324');
  expect(sha(priorBytes(serializeMatch(state),'v24'))).toBe('99174cbf08013d1ee651990be6036b6ab0ddba8a6a4f1cd5660acd35decee431');
});

it('Void Swarm retains its complete historical save bytes after only epoch/null-field substitution', () => {
  const open = reachRound('2-1',false,53);
  expect(open.pendingChoice!.offers).toContain('void-swarm');
  let state: MatchState = resolveM5Choices(open,['void-swarm']);
  state = accepted(deployMatchUnit(state,state.preparation.units.find(u=>u.team==='player')!.id,{kind:'board',cell:{col:3,row:4}}));
  state = accepted(startMatchCombat(state));
  expect(sha(priorBytes(serializeMatch(state),'v25'))).toBe('8dedd86620e10240b954970b1f2c544e9dc8275ab65c5c5a2bb59c889bd8178d');
});
