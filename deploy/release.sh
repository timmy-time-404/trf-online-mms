#!/bin/sh
# Release or roll back the app on the VPS. Used by GitHub Actions and by humans.
#
#   deploy/release.sh release <tag> <path/to/release.tar.gz>
#   deploy/release.sh rollback <previous-tag>
#
# release: backup DB -> replace source -> build images -> migrate -> restart -> health check.
# rollback: restart the previous images. Migrations are forward-only, so roll back only
# to a release whose code works with the current schema.
set -eu

ROOT=/opt/trf-dev/foundation
BACKUPS=/opt/trf-dev/backups
cd "$ROOT"

action=${1:-}
tag=${2:-}
case "$tag" in
  ''|*[!A-Za-z0-9._-]*) echo "Invalid release tag." >&2; exit 2 ;;
esac

BASE="docker compose --env-file deploy/.env -f deploy/compose.yaml"
FULL="$BASE -f deploy/compose.auth.yaml -f deploy/compose.domain.yaml"

health() {
  for _ in $(seq 1 30); do
    if curl -fsS "https://$(grep '^APP_DOMAIN=' deploy/.env | cut -d= -f2)/api/health" >/dev/null 2>&1; then
      echo "Health check passed."; return 0
    fi
    sleep 2
  done
  echo "Health check failed." >&2; return 1
}

set_tag() { sed -i "s/^RELEASE_TAG=.*/RELEASE_TAG=$1/" deploy/.env; }

case "$action" in
  release)
    archive=${3:-}
    [ -f "$archive" ] || { echo "Release archive not found." >&2; exit 2; }
    previous=$(grep '^RELEASE_TAG=' deploy/.env | cut -d= -f2)
    mkdir -p "$BACKUPS" && chmod 700 "$BACKUPS"
    $BASE exec -T db pg_dump -U trf_owner -d trf -Fc > "$BACKUPS/pre-$tag-$(date +%Y%m%d%H%M).dump"
    # The public gateway bind-mounts this file and runs with "admin off", so a new version
    # is only picked up by restarting the container (see below).
    caddy_before=$(sha256sum deploy/Caddyfile.domain 2>/dev/null || true)
    # Remove old source first so files deleted in git do not survive (secrets and .env stay).
    rm -rf apps packages db
    tar -xzf "$archive"
    caddy_after=$(sha256sum deploy/Caddyfile.domain 2>/dev/null || true)
    sh deploy/init-secrets.sh >/dev/null
    set_tag "$tag"
    $FULL build
    $BASE run --rm db-tools
    $BASE run --rm db-tools node dist/db/provision-runtime.js
    if ! $FULL up -d --wait --wait-timeout 180 || ! health; then
      echo "Release $tag failed; restoring $previous." >&2
      set_tag "$previous"
      $FULL up -d --wait --wait-timeout 180 || true
      exit 1
    fi
    # "up -d" keeps the gateway running when only the mounted Caddyfile changed.
    if [ "$caddy_before" != "$caddy_after" ]; then
      echo "Caddyfile.domain changed; restarting the public gateway."
      $FULL restart public-gateway
      health
    fi
    # Keep the last five dumps.
    ls -1t "$BACKUPS"/pre-*.dump 2>/dev/null | tail -n +6 | xargs -r rm -f
    echo "Released $tag (previous: $previous)."
    ;;
  rollback)
    docker image inspect "trf-api:$tag" >/dev/null 2>&1 || { echo "No images for $tag." >&2; exit 2; }
    set_tag "$tag"
    $FULL up -d --wait --wait-timeout 180
    health
    echo "Rolled back to $tag."
    ;;
  *)
    echo "Usage: deploy/release.sh release <tag> <archive> | rollback <tag>" >&2; exit 2 ;;
esac
