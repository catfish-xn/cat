export interface AppShell {
  readonly board: HTMLElement; readonly strategy: HTMLElement; readonly save: HTMLElement;
  readonly replay: HTMLElement; readonly stats: HTMLElement; readonly feedback: HTMLElement;
  dispose(): void;
}
/** Independent mounts survive StrategyPanel.render() replacing its own children. */
export function createAppShell(app: HTMLElement): AppShell {
  const node = (tag: string, id: string, label: string) => { const n=document.createElement(tag); n.id=id; n.setAttribute('aria-label',label); return n; };
  const boardFrame=node('main','board-frame','自动战棋棋盘');
  const board=node('div','board-root','八行七列棋盘与备战席');
  const feedback=node('div','feedback-root','战斗反馈'); feedback.setAttribute('aria-live','polite');
  const panels=node('aside','panels-root','对局操作与信息');
  const strategy=node('section','strategy-root','策略构筑');
  const save=node('section','save-root','对局与存档');
  const replay=node('section','replay-root','战斗回放');
  const stats=node('section','stats-root','战斗统计');
  boardFrame.append(board,feedback);panels.append(strategy,save,replay,stats);app.replaceChildren(boardFrame,panels);
  return {board,strategy,save,replay,stats,feedback,dispose(){boardFrame.remove();panels.remove();}};
}
