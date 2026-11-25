#!/bin/sh
# Daily image cleanup that keeps rollback possible. Replaces the old
# "docker image prune -af --filter until=24h", which deleted the previous release's images
# about a day after every deploy. Installed as /usr/local/sbin/trf-image-prune, run from
# /etc/cron.d/trf-image-prune.
set -eu

KEEP=${KEEP:-5}

# Keep the newest $KEEP release tags of each app image; images still used by a container
# cannot be removed and are skipped.
for repo in trf-api trf-web; do
  docker image ls "$repo" --format '{{.CreatedAt}}|{{.Repository}}:{{.Tag}}' \
    | sort -r | tail -n +"$((KEEP + 1))" | cut -d'|' -f2 \
    | while read -r image; do docker image rm "$image" > /dev/null 2>&1 || true; done
done

# Untagged leftovers from builds only (no -a, so tagged images are never touched here).
docker image prune -f --filter "until=24h" > /dev/null
