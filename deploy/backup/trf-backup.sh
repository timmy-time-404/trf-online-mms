#!/bin/sh
# Daily offsite backup of TRF Online: database dump, uploaded documents and deploy secrets,
# encrypted by restic and stored in S3-compatible storage (Backblaze B2 now; Cloudflare R2 also works). Installed as /usr/local/sbin/trf-backup
# and run by trf-backup.timer. Settings live in /etc/trf-backup/env (root, mode 600):
#
#   RESTIC_REPOSITORY=s3:https://<s3-endpoint>/<bucket>   (Backblaze B2 or Cloudflare R2)
#   AWS_DEFAULT_REGION=<region>   (B2: e.g. us-west-004; R2: auto, the default)
#   RESTIC_PASSWORD_FILE=/etc/trf-backup/restic-password
#   AWS_ACCESS_KEY_ID=...
#   AWS_SECRET_ACCESS_KEY=...
#   HEARTBEAT_URL=...        (optional; pinged only after a fully successful run)
set -eu

. /etc/trf-backup/env
export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

ROOT=/opt/trf-dev/foundation
STAGE=/var/backups/trf
COMPOSE="docker compose --env-file $ROOT/deploy/.env -f $ROOT/deploy/compose.yaml"
umask 077
mkdir -p "$STAGE"
cd "$ROOT"

# Dump to a temporary file and check that pg_restore can read it before replacing the last one.
$COMPOSE exec -T db pg_dump -U trf_owner -d trf -Fc > "$STAGE/trf.dump.tmp"
$COMPOSE exec -T db pg_restore -l < "$STAGE/trf.dump.tmp" > /dev/null
mv "$STAGE/trf.dump.tmp" "$STAGE/trf.dump"

documents=$(docker volume inspect -f '{{.Mountpoint}}' trf-dev_documents)
restic backup --host meong --tag daily \
  "$STAGE" "$documents" "$ROOT/deploy/.env" "$ROOT/deploy/secrets"
restic forget --host meong --tag daily --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
# Once a week, read back part of the stored data to catch silent corruption.
if [ "$(date +%u)" = 7 ]; then restic check --read-data-subset=5%; fi

if [ -n "${HEARTBEAT_URL:-}" ]; then curl -fsS -m 10 --retry 3 "$HEARTBEAT_URL" > /dev/null; fi
echo "Backup finished."
