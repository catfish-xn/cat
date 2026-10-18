import { expect, it } from 'vitest';
import { createMatch, enableMultiplayerSettlement, advanceMultiplayerRound, startMatchCombat, stepMatch,
  claimOrDiscardLoot, forfeitPendingChoice, selectChoice, buyXp, buyUnit, rerollShop, deployMatchUnit,
  snapshotForBattle, compileBattle, resolveTwoSidedBattle, proposeSettlement, applyRoundSettlement,
  ROUND_SETTLEMENT_VERSION, type MatchState } from '../src/server-entry';
import { accepted, catalogPreparation, finalSettlement } from './t5r-helpers';
import { readG23Progress } from '../src/simulation/g2-3-state';

it('three Black Rose champions compile one Sion per side at 6-6 and after advancing into overtime', () => {
  const base = catalogPreparation('6-6');
  const state: MatchState = { ...base, level: 3, preparation: { ...base.preparation,
    units: ['morgana', 'vladimir', 'cassiopeia'].map((definitionId, col) => ({
      id: `unit-${col + 1}`, definitionId, starLevel: 1, team: 'player',
      location: { kind: 'board', cell: { col, row: 4 } } })) } };
  const overtime = accepted(advanceMultiplayerRound(finalSettlement(
    accepted(enableMultiplayerSettlement(state, 'A'))), 38));
  expect(overtime.round).toBe(39);
  const sionHp: number[] = [];
  for (const preparation of [state, overtime]) {
    const battle = compileBattle(snapshotForBattle(preparation, 'A'), snapshotForBattle(preparation, 'B'), 42);
    for (const team of ['player', 'enemy']) {
      const sions = battle.preparation.units.filter(u => u.definitionId === 'g23-sion' && u.team === team);
      expect(sions).toHaveLength(1);
      const compiled = battle.strategy.units.find(u => u.unitId === sions[0].id)!;
      expect(compiled.mechanics).toContainEqual(expect.objectContaining({ mechanic: 'g23Sion', values: { tier: 3 } }));
      sionHp.push(compiled.stats.health);
    }
  }
  // The original five-entry growth table caps at stage 6, including overtime's stage 7.
  expect(sionHp).toEqual([1450, 1450, 1450, 1450]);
});

it('public production commands reach ordinal 39, resolve its earned armory, and settle real overtime combat once', () => {
  let state = accepted(enableMultiplayerSettlement(createMatch(42), 'A'));
  const receipts = [];
  let rumbleId: string | undefined;
  let armoryId: string | undefined;
  while (state.round <= 39) {
    if (state.phase === 'choice') {
      const choice = state.pendingChoice!;
      if (state.round === 39) {
        expect(choice).toMatchObject({ kind: 'armory', returnPhase: 'preparation' });
        expect(readG23Progress(state)!.junkerRounds).toBe(3);
        armoryId = choice.choiceId;
        state = accepted(selectChoice(state, choice.choiceId, choice.generation, 'spare-parts'));
        expect(state).toMatchObject({ phase: 'preparation', pendingChoice: null });
      } else state = accepted(forfeitPendingChoice(state, state.round, choice.choiceId, choice.generation));
      continue;
    }
    if (state.phase === 'preparation') {
      if (state.round === 36 && !rumbleId) {
        while (state.level < 9) state = accepted(buyXp(state));
        let slot = state.shop.slots.findIndex(s => s.status === 'available' && s.definitionId === 'rumble');
        for (let rolls = 0; slot < 0 && rolls < 100; rolls++) {
          state = accepted(rerollShop(state));
          slot = state.shop.slots.findIndex(s => s.status === 'available' && s.definitionId === 'rumble');
        }
        expect(slot).toBeGreaterThanOrEqual(0);
        state = accepted(buyUnit(state, slot, state.shop.generation));
        rumbleId = state.preparation.units.find(u => u.definitionId === 'rumble')!.id;
        state = accepted(deployMatchUnit(state, rumbleId, { kind: 'board', cell: { col: 3, row: 4 } }));
      }
      if (state.m8.round.kind === 'pvp') {
        // Deployment commands make an empty opponent until overtime, then leave one real defender.
        // The advancing seat, its history, progression and receipts are never patched.
        let opponent = state;
        for (const unit of opponent.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board'
          && (state.round !== 39 || u.id === rumbleId))) {
          const slot = Array.from({ length: 9 }, (_, n) => n).find(n => !opponent.preparation.units.some(
            u => u.location.kind === 'bench' && u.location.slot === n))!;
          opponent = accepted(deployMatchUnit(opponent, unit.id, { kind: 'bench', slot }));
        }
        const battle = resolveTwoSidedBattle(compileBattle(snapshotForBattle(state, 'A'), snapshotForBattle(opponent, 'B'),
          42, { battleId: `natural:${state.round}` }), 1201);
        const proposal = proposeSettlement(battle).a;
        const { events: _events, ...fields } = proposal;
        const receipt = { ...fields, version: ROUND_SETTLEMENT_VERSION,
          settlementId: `${battle.battleId}:A`, round: state.round,
          combatTicks: battle.terminal.tick, combatEventCount: battle.events.length };
        receipts.push(receipt);
        state = accepted(applyRoundSettlement(state, receipt));
        expect(state.multiplayer!.receipts.at(-1)).toEqual(receipt);
        if (state.round === 39) {
          expect(battle.terminal.tick).toBeGreaterThan(0);
          expect(battle.initial.units.filter(u => u.team === 'enemy')).toHaveLength(1);
          expect(proposal.g23Facts).toMatchObject({ round: 39, rumbleStar: 1 });
          expect(armoryId).toBeDefined();
          expect(state.phase).toBe('settlement');
          expect(state.roundResults.map(r => r.round)).toEqual(Array.from({ length: 39 }, (_, n) => n + 1));
          expect(readG23Progress(state)!.junkerPurchases).toContainEqual(expect.objectContaining({ id: armoryId, round: 39, unitId: rumbleId, upgrade: 'spare-parts' }));
          expect(state.seatMechanics!.receipts.filter(r => r.receiptId === armoryId)).toHaveLength(1);
          expect(applyRoundSettlement(state, receipt)).toEqual({ ok: false, state, reason: 'duplicate-settlement' });
        }
      } else state = accepted(startMatchCombat(state));
    } else if (state.phase === 'combat') state = stepMatch(state).state;
    else {
      expect(state.phase).toBe('settlement');
      state = accepted(claimOrDiscardLoot(state, state.round));
      if (state.phase === 'choice') continue;
      state = accepted(advanceMultiplayerRound(state, state.round));
    }
  }
  expect(state).toMatchObject({ round: 40, phase: 'preparation' });
  expect(state.multiplayer!.receipts).toEqual(receipts);
});
