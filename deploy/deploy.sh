#!/usr/bin/env bash
# Cat 八人联机服务器：按提交 SHA 一键部署 / 回滚（G3）。
#
#   deploy/deploy.sh <提交SHA>          拉取该提交 → npm ci → build:game → 前端 build → 原子切换 current → 重启 → 健康检查；
#                                      健康检查失败自动切回上一个版本目录并重启。
#   deploy/deploy.sh rollback          不构建，直接切回 previous 指向的版本并重启、检查。
#   deploy/deploy.sh status            打印 current / previous 与 /healthz。
#
# 选项（放在 SHA 之后）：
#   --force       有真人在对局中也照样切换（默认拒绝：重启会中断当前对局）。
#   --no-restart  只构建、切换目录，不重启也不检查（极少用；手动重启后自行看 /healthz）。
#
# 环境变量（都有默认值，见 docs/MULTIPLAYER_RELEASE_NOTES.md 第 2 节）：
#   CAT_ROOT            发布根目录，默认 /srv/cat（其下 source/ releases/<sha>/ current previous）
#   CAT_REPO            Git 仓库地址，默认 https://github.com/catfish-xn/cat.git（也可以是本地路径）
#   CAT_NODE_BIN        Node 22 的 bin 目录，默认 /opt/node22/bin（存在时放到 PATH 最前）
#   CAT_HEALTH_URL      健康检查地址，默认 http://127.0.0.1:8787/healthz
#   CAT_HEALTH_TIMEOUT  重启后等待健康的秒数，默认 40
#   CAT_RESTART_CMD     重启命令，默认 "sudo systemctl restart cat-game"
#   CAT_KEEP_RELEASES   保留的版本目录数（current/previous 总是保留），默认 5
#
# 要求：bash、git、tar、Node 22.12+（自带 npm 与 fetch）。不需要 curl/jq。
# 构建在 releases/<sha>.tmp-* 里完成，成功后才 rename 成 releases/<sha>；current 用 "ln -sfn + mv -T" 原子切换。
set -euo pipefail

CAT_ROOT=${CAT_ROOT:-/srv/cat}
CAT_REPO=${CAT_REPO:-https://github.com/catfish-xn/cat.git}
CAT_NODE_BIN=${CAT_NODE_BIN:-/opt/node22/bin}
CAT_HEALTH_URL=${CAT_HEALTH_URL:-http://127.0.0.1:8787/healthz}
CAT_HEALTH_TIMEOUT=${CAT_HEALTH_TIMEOUT:-40}
CAT_RESTART_CMD=${CAT_RESTART_CMD:-sudo systemctl restart cat-game}
CAT_KEEP_RELEASES=${CAT_KEEP_RELEASES:-5}

[ -d "$CAT_NODE_BIN" ] && export PATH="$CAT_NODE_BIN:$PATH"

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die() { log "失败：$*"; exit 1; }

RELEASES="$CAT_ROOT/releases"
SOURCE="$CAT_ROOT/source"
CURRENT="$CAT_ROOT/current"
PREVIOUS="$CAT_ROOT/previous"

# ---------- helpers ----------

# Prints the /healthz JSON (one line) or fails.
health_json() {
  node -e '
    const url = process.argv[1];
    fetch(url, { cache: "no-store" }).then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); process.stdout.write(JSON.stringify(await r.json())); })
      .catch(e => { process.stderr.write(String(e.message || e) + "\n"); process.exit(1); });' "$CAT_HEALTH_URL"
}
# health_field <json> <path.to.field>
health_field() { node -e 'let v = JSON.parse(process.argv[1]); for (const k of process.argv[2].split(".")) v = v == null ? null : v[k]; process.stdout.write(v == null ? "" : String(v));' "$1" "$2"; }

# Waits until /healthz answers with sha == $1.
wait_healthy() {
  local want=$1 deadline=$(( $(date +%s) + CAT_HEALTH_TIMEOUT )) json='' got=''
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if json=$(health_json 2>/dev/null); then
      got=$(health_field "$json" sha)
      if [ "$got" = "$want" ] && [ "$(health_field "$json" status)" = ok ]; then
        log "健康检查通过：$json"
        printf '%s\n' "$json"
        return 0
      fi
    fi
    sleep 1
  done
  log "健康检查超时（${CAT_HEALTH_TIMEOUT}s）：期望 sha=$want，最后一次 sha=${got:-无响应}"
  return 1
}

# Atomically points $1 (a symlink path) at directory $2.
switch_link() {
  ln -sfn "$2" "$1.next"
  mv -Tf "$1.next" "$1"
}

# fd 9 (the deploy lock) is closed for the restarted service, so a server started in the background never holds it.
restart() { log "重启：$CAT_RESTART_CMD"; bash -c "$CAT_RESTART_CMD" 9>&-; }

# Refuses to interrupt a match with connected humans unless --force.
guard_running_match() {
  local json phase humans
  json=$(health_json 2>/dev/null) || { log "当前服务无响应，跳过对局检查"; return 0; }
  phase=$(health_field "$json" room.phase)
  humans=$(health_field "$json" room.humansConnected)
  if [ -n "$phase" ] && [ "$phase" != ended ] && [ "${humans:-0}" -gt 0 ]; then
    [ "$FORCE" = 1 ] && { log "警告：第 $(health_field "$json" room.round) 回合有 $humans 名真人在线，--force 照样切换"; return 0; }
    die "当前对局进行中（阶段 $phase，在线真人 $humans）。等对局结束（/healthz room.phase=ended 或无房间）再部署，或加 --force"
  fi
}

prune_releases() {
  local keep_current keep_previous count=0 dir
  keep_current=$(readlink -f "$CURRENT" 2>/dev/null || true)
  keep_previous=$(readlink -f "$PREVIOUS" 2>/dev/null || true)
  # Newest first; *.tmp-* build leftovers of an interrupted run go too.
  for dir in $(ls -1dt "$RELEASES"/*/ 2>/dev/null); do
    dir=${dir%/}
    case "$dir" in *.tmp-*) rm -rf "$dir"; continue ;; esac
    if [ "$dir" = "$keep_current" ] || [ "$dir" = "$keep_previous" ]; then continue; fi
    count=$((count + 1))
    if [ "$count" -gt "$CAT_KEEP_RELEASES" ]; then log "清理旧版本目录 $dir"; rm -rf "$dir"; fi
  done
}

# ---------- commands ----------

cmd_status() {
  echo "current  -> $(readlink -f "$CURRENT" 2>/dev/null || echo 无)"
  echo "previous -> $(readlink -f "$PREVIOUS" 2>/dev/null || echo 无)"
  health_json && echo || echo "（/healthz 无响应：$CAT_HEALTH_URL）"
}

cmd_rollback() {
  local target from
  target=$(readlink -f "$PREVIOUS" 2>/dev/null || true)
  [ -n "$target" ] && [ -f "$target/dist-server/game/main.mjs" ] || die "没有可回滚的 previous 版本"
  from=$(readlink -f "$CURRENT" 2>/dev/null || true)
  guard_running_match
  switch_link "$CURRENT" "$target"
  [ -n "$from" ] && switch_link "$PREVIOUS" "$from"
  restart
  wait_healthy "$(basename "$target")" >/dev/null || die "回滚后的版本也没有通过健康检查，请看 journalctl -u cat-game"
  log "已回滚到 $(basename "$target")"
}

build_release() {
  local sha=$1 dir=$2 tmp
  tmp="$dir.tmp-$$"
  rm -rf "$tmp"; mkdir -p "$tmp"
  log "导出 $sha 到 $tmp"
  git -C "$SOURCE" archive --format=tar "$sha" | tar -x -C "$tmp"
  (
    cd "$tmp"
    node -e 'const [maj, min] = process.versions.node.split(".").map(Number); if (maj !== 22 || min < 12) { console.error(`需要 Node 22.12+，当前 ${process.version}`); process.exit(1); }'
    log "npm ci（含开发依赖，构建需要）"
    npm ci --no-audit --no-fund --loglevel=error
    log "npm run build:game"
    npm run --silent build:game
    log "npm run build（前端，页面右下角显示 $sha）"
    VITE_CAT_SHA="$sha" npm run --silent build
    node --check dist-server/game/main.mjs
    test -f dist/index.html
    log "npm prune --omit=dev（运行只需要 ws）"
    npm prune --omit=dev --no-audit --no-fund --loglevel=error
    printf 'CAT_GIT_SHA=%s\n' "$sha" > release.env
    printf 'sha=%s\nbuilt=%s\nnode=%s\n' "$sha" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(node --version)" > .release-ok
  ) || { rm -rf "$tmp"; die "构建 $sha 失败，current 未改动"; }
  mv -T "$tmp" "$dir"
}

cmd_deploy() {
  local want=$1 sha dir from
  [[ "$want" =~ ^[0-9a-fA-F]{7,40}$ ]] || die "请给出提交 SHA（7–40 位十六进制），收到 \"$want\""
  mkdir -p "$RELEASES"
  if [ ! -d "$SOURCE/.git" ] && [ ! -f "$SOURCE/HEAD" ]; then
    log "首次克隆 $CAT_REPO → $SOURCE"
    git clone --bare --quiet "$CAT_REPO" "$SOURCE"
  fi
  log "git fetch"
  git -C "$SOURCE" fetch --quiet --prune "$CAT_REPO" '+refs/heads/*:refs/heads/*' || die "git fetch 失败"
  if ! git -C "$SOURCE" cat-file -e "$want^{commit}" 2>/dev/null; then
    git -C "$SOURCE" fetch --quiet "$CAT_REPO" "$want" 2>/dev/null || true
  fi
  sha=$(git -C "$SOURCE" rev-parse --verify --quiet "$want^{commit}") || die "仓库里找不到提交 $want（先推送，或检查 CAT_REPO）"
  dir="$RELEASES/$sha"

  if [ -f "$dir/.release-ok" ]; then log "版本目录已存在且完整，复用 $dir"
  else rm -rf "$dir"; build_release "$sha" "$dir"; fi

  from=$(readlink -f "$CURRENT" 2>/dev/null || true)
  if [ "$from" = "$dir" ]; then log "current 已是 $sha"; fi
  guard_running_match

  log "切换 current → $dir"
  switch_link "$CURRENT" "$dir"
  [ -n "$from" ] && [ "$from" != "$dir" ] && switch_link "$PREVIOUS" "$from"

  if [ "$NO_RESTART" = 1 ]; then log "--no-restart：未重启。手动重启后检查 $CAT_HEALTH_URL"; return 0; fi
  restart
  if wait_healthy "$sha" >/dev/null; then
    prune_releases
    log "部署完成：$sha"
    health_json; echo
    return 0
  fi

  if [ -n "$from" ] && [ "$from" != "$dir" ] && [ -f "$from/dist-server/game/main.mjs" ]; then
    log "新版本未通过健康检查，自动回滚到 $(basename "$from")"
    switch_link "$CURRENT" "$from"
    switch_link "$PREVIOUS" "$dir"
    restart
    wait_healthy "$(basename "$from")" >/dev/null || die "回滚后的版本也没有通过健康检查，请看 journalctl -u cat-game"
    die "已自动回滚到 $(basename "$from")；新版本 $sha 保留在 $dir 供排查"
  fi
  die "新版本未通过健康检查，且没有可回滚的上一版本"
}

# ---------- main ----------

[ $# -ge 1 ] || { sed -n '2,24p' "$0"; exit 2; }
ACTION=$1; shift
FORCE=0; NO_RESTART=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --no-restart) NO_RESTART=1 ;;
    *) die "未知选项 $arg" ;;
  esac
done

mkdir -p "$CAT_ROOT"
exec 9>"$CAT_ROOT/.deploy.lock"
flock -n 9 || die "另一个部署正在运行（$CAT_ROOT/.deploy.lock）"

case "$ACTION" in
  status) cmd_status ;;
  rollback) cmd_rollback ;;
  -h|--help|help) sed -n '2,24p' "$0" ;;
  *) cmd_deploy "$ACTION" ;;
esac
