import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchCommandResult, MatchFailure } from '../../src/simulation/match-types';
import { createMatch } from '../../src/simulation/match';
import type { ClientSendResult, GameClient } from '../../src/rendering/online/protocol';
import { RemoteSession } from '../../src/rendering/online/remote-session';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { BoardScene } from '../../src/rendering/BoardScene';

type ChoiceToken = { choiceId: string; generation: number };
interface SceneBridge {
  session: { dispose(): void };
  strategyPanel: { choiceRefused: ReturnType<typeof vi.fn> };
  pendingChoices: Map<number, ChoiceToken>;
  selectedId: string | null;
  command(result: MatchCommandResult, message: string, equipment?: boolean, benchMove?: boolean, choice?: ChoiceToken): void;
  confirmed(commandIds: readonly number[], events: readonly never[]): void;
  refused(commandId: number, reason: MatchFailure | null, text: string | null): void;
  setStatus: ReturnType<typeof vi.fn>;
}
const sessions: RemoteSession[] = [];
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); vi.restoreAllMocks(); });

function pendingScene() {
  let commandId = 0;
  const send = vi.fn<(...args: unknown[]) => ClientSendResult>(() => ({ ok: 'pending', commandId: ++commandId }));
  // The transport queues intents; use the real RemoteSession notice and BoardScene receipt paths.
  const session = new RemoteSession({ send } as unknown as GameClient, createMatch(42));
  sessions.push(session);
  const scene = new BoardScene() as unknown as SceneBridge;
  scene.session.dispose(); scene.session = session;
  scene.strategyPanel = { choiceRefused: vi.fn() }; scene.setStatus = vi.fn();
  return { scene, session, send };
}

describe('P2 anomaly action refusal routing', () => {
  const token = { choiceId: 'round:4-6:anomaly', generation: 3 };
  it.each(['target', 'choose', 'reroll'] as const)('only releases a pending %s for its own command receipt', action => {
    const { scene, session } = pendingScene();
    const result = action === 'target' ? session.anomalyTarget(token.choiceId, token.generation, 'unit-1') : action === 'choose' ? session.choose(token.choiceId, token.generation, 'the-finisher') : session.anomalyReroll(token.choiceId, token.generation);
    scene.command(result, '异变操作', false, false, token);
    scene.command(session.buyXp(), '购买经验');
    scene.refused(2, 'insufficient-gold', null);
    expect(scene.strategyPanel.choiceRefused).not.toHaveBeenCalled();
    scene.refused(1, 'invalid-choice', null);
    expect(scene.strategyPanel.choiceRefused).toHaveBeenCalledExactlyOnceWith(token.choiceId, token.generation);
    expect(scene.pendingChoices.size).toBe(0);
    scene.refused(1, 'invalid-choice', null);
    expect(scene.strategyPanel.choiceRefused).toHaveBeenCalledTimes(1);
  });

  it('releases a synchronous offline notification without waiting for another snapshot', () => {
    const { scene, session, send } = pendingScene();
    session.offline = '连接中断，重连中…';
    scene.command(session.choose(token.choiceId, token.generation, 'the-finisher'), '异变操作', false, false, token);
    expect(send).not.toHaveBeenCalled();
    expect(scene.strategyPanel.choiceRefused).toHaveBeenCalledExactlyOnceWith(token.choiceId, token.generation);
    expect(scene.setStatus).toHaveBeenCalledExactlyOnceWith(session.offline);
    expect(scene.pendingChoices.size).toBe(0);
  });

  it('releases an immediate rule refusal from a synchronous online client', () => {
    const { scene, session, send } = pendingScene();
    send.mockReturnValue({ ok: false, state: session.state, reason: 'invalid-choice' });
    scene.command(session.anomalyReroll(token.choiceId, token.generation), '异变操作', false, false, token);
    expect(scene.strategyPanel.choiceRefused).toHaveBeenCalledExactlyOnceWith(token.choiceId, token.generation);
    expect(scene.setStatus).toHaveBeenCalledExactlyOnceWith('当前选择无效');
    expect(scene.pendingChoices.size).toBe(0);
  });

  it('forgets a successful command without treating confirmation as a refusal', () => {
    const { scene, session } = pendingScene();
    scene.command(session.anomalyReroll(token.choiceId, token.generation), '异变操作', false, false, token);
    // Rendering a success is covered by the panel suite; keep this test on receipt routing.
    const renderSuccess = vi.spyOn(scene, 'command').mockImplementation(() => undefined);
    scene.confirmed([1], []);
    // Star-up animation (8af7500b) added a fifth argument: confirmed receipts render with animateUpgrades=false,
    // because the online unitUpgraded event already animated them (v25 call had four arguments).
    expect(renderSuccess).toHaveBeenCalledExactlyOnceWith({ ok: true, state: session.state, events: [] }, '异变操作', false, false, false);
    expect(scene.pendingChoices.size).toBe(0);
    scene.refused(1, 'invalid-choice', null);
    expect(scene.strategyPanel.choiceRefused).not.toHaveBeenCalled();
  });
});
