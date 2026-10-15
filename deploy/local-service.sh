#!/usr/bin/env bash
# 不用 systemd 的本地服务替身（G3 干跑部署用）：从 $CAT_ROOT/current 启动/停止游戏服务器，pid 写在 $CAT_ROOT/game.pid，
# 输出写在 $CAT_ROOT/game.log。环境与 systemd 单元一致：先读 $CAT_ENV_FILE（默认不读），再读 current/release.env。
#
#   CAT_ROOT=/tmp/x CAT_RESTART_CMD="deploy/local-service.sh restart" deploy/deploy.sh <sha>
#   CAT_ROOT=/tmp/x deploy/local-service.sh stop
set -euo pipefail
CAT_ROOT=${CAT_ROOT:-/srv/cat}
PIDFILE="$CAT_ROOT/game.pid"

stop() {
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    kill -TERM "$(cat "$PIDFILE")"
    for _ in $(seq 1 50); do kill -0 "$(cat "$PIDFILE")" 2>/dev/null || break; sleep 0.2; done
  fi
  rm -f "$PIDFILE"
}
start() {
  local dir; dir=$(readlink -f "$CAT_ROOT/current")
  (
    set -a
    [ -n "${CAT_ENV_FILE:-}" ] && . "$CAT_ENV_FILE"
    [ -f "$dir/release.env" ] && . "$dir/release.env"
    set +a
    cd "$dir"
    nohup node "$dir/dist-server/game/main.mjs" >>"$CAT_ROOT/game.log" 2>&1 &
    echo $! > "$PIDFILE"
  )
}
case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  *) echo "用法：$0 start|stop|restart" >&2; exit 2 ;;
esac
