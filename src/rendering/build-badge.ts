/**
 * G3: a small bottom-right label with the build this page runs and, against the real game server (`?mode=online&server=ws`),
 * the build the server reports on GET /healthz, so a deployment can be confirmed on the real machine. A digest or
 * protocol difference between page and server is flagged (refresh the page). Display only: nothing here reaches a rule.
 */
import { CONTENT_DIGEST } from '../simulation/content';
import { LOOT_REPLAY_DIGEST } from '../simulation/loot-freeze';
import { NET_PROTOCOL_VERSION } from '../server/net/messages';
import { isOnlineMode, readServerKind, readWsOptions } from './online/mode';

/** The deploy script builds the page with VITE_CAT_SHA=<commit>; a dev server shows "dev". */
const CLIENT_SHA = ((import.meta as unknown as { env?: { VITE_CAT_SHA?: string } }).env?.VITE_CAT_SHA ?? '').trim() || 'dev';
const REFRESH_MS = 60_000;

interface ServerHealth { readonly sha: string; readonly contentDigest: string; readonly lootReplayDigest: string; readonly netProtocol: number }

const shortSha = (sha: string) => /^[0-9a-f]{8,}$/i.test(sha) ? sha.slice(0, 7) : sha;
const shortDigest = (digest: string) => digest.slice(digest.lastIndexOf(':') + 1);

/** ws://host:port → http://host:port/healthz; wss://host/ws → https://host/ws/healthz (served through the same proxy). */
export function healthUrlOf(wsUrl: string): string | null {
  try {
    const url = new URL(wsUrl);
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/healthz`;
    url.search = ''; url.hash = '';
    return url.toString();
  } catch { return null; }
}

export function mountBuildBadge(host: HTMLElement, search = window.location.search): () => void {
  const root = document.createElement('div');
  root.className = 'build-badge';
  root.dataset.debug = 'build-badge';
  const client = document.createElement('span');
  client.textContent = `页面 ${shortSha(CLIENT_SHA)} · 内容 ${shortDigest(CONTENT_DIGEST)}`;
  client.title = `CONTENT_DIGEST ${CONTENT_DIGEST}\nLOOT_REPLAY_DIGEST ${LOOT_REPLAY_DIGEST}\n协议 ${NET_PROTOCOL_VERSION}`;
  root.append(client);
  host.append(root);
  const healthUrl = isOnlineMode(search) && readServerKind(search) === 'websocket' ? healthUrlOf(readWsOptions(search).url) : null;
  if (!healthUrl) return () => root.remove();

  const server = document.createElement('span');
  server.dataset.debug = 'build-badge-server';
  server.textContent = '服务器 …';
  root.append(server);
  let disposed = false;
  const refresh = async () => {
    try {
      const response = await fetch(healthUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const health = await response.json() as ServerHealth;
      if (disposed) return;
      const mismatch = health.contentDigest !== CONTENT_DIGEST || health.lootReplayDigest !== LOOT_REPLAY_DIGEST || health.netProtocol !== NET_PROTOCOL_VERSION;
      server.textContent = `服务器 ${shortSha(health.sha)} · 内容 ${shortDigest(health.contentDigest)}${mismatch ? ' · 版本不一致，请刷新' : ''}`;
      server.title = `CONTENT_DIGEST ${health.contentDigest}\nLOOT_REPLAY_DIGEST ${health.lootReplayDigest}\n协议 ${health.netProtocol}`;
      root.dataset.serverSha = health.sha;
      root.classList.toggle('mismatch', mismatch);
    } catch {
      if (!disposed) { server.textContent = '服务器 未连接'; delete root.dataset.serverSha; }
    }
  };
  void refresh();
  const timer = window.setInterval(() => void refresh(), REFRESH_MS);
  return () => { disposed = true; window.clearInterval(timer); root.remove(); };
}
