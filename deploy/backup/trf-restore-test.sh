#!/bin/sh
# Restore test: restores the latest backup into a throwaway PostgreSQL container and compares
# row counts with the live database. Touches nothing in the running application.
# Installed as /usr/local/sbin/trf-restore-test. Run monthly and record the result.
set -eu

. /etc/trf-backup/env
export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

ROOT=/opt/trf-dev/foundation
COMPOSE="docker compose --env-file $ROOT/deploy/.env -f $ROOT/deploy/compose.yaml"
WORK=$(mktemp -d /var/tmp/trf-restore.XXXXXX)
NAME=trf-restore-test
cleanup() { docker rm -f "$NAME" > /dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
started=$(date +%s)

restic restore latest --host meong --tag daily --target "$WORK" --include /var/backups/trf/trf.dump
dump="$WORK/var/backups/trf/trf.dump"
[ -s "$dump" ] || { echo "Restored dump is missing or empty." >&2; exit 1; }

image=$(docker inspect -f '{{.Config.Image}}' "$(cd "$ROOT" && $COMPOSE ps -q db)")
docker run -d --name "$NAME" --network none -e POSTGRES_PASSWORD=restore-test "$image" > /dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres -q && break; sleep 2; done
docker exec "$NAME" createdb -U postgres trf
# Roles are not part of a database dump; ownership and grants are skipped on purpose.
docker exec -i "$NAME" pg_restore -U postgres -d trf --no-owner --no-acl --exit-on-error < "$dump"

counts="select (select count(*) from public.trfs)||' '||(select count(*) from public.employees)||' '||(select count(*) from public.users)||' '||(select count(*) from drizzle.__drizzle_migrations)"
restored=$(docker exec "$NAME" psql -U postgres -d trf -tAc "$counts")
live=$(cd "$ROOT" && $COMPOSE exec -T db psql -U trf_owner -d trf -tAc "$counts")
echo "trfs employees users migrations"
echo "restored: $restored"
echo "live:     $live"
echo "Restore took $(( $(date +%s) - started )) seconds."
[ "$restored" = "$live" ] || echo "Counts differ: expected when data changed after the last backup; check the backup time."
