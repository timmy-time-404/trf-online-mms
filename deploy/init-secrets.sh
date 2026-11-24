#!/bin/sh
set -eu
cd "$(dirname "$0")"
umask 077
mkdir -p secrets
if [ -e secrets/postgres_password ]; then
    test -s secrets/postgres_password || { echo 'Existing database secret is empty.' >&2; exit 1; }
    echo 'Existing database secret retained.'
else
    # Noclobber also protects an existing secret if two setup processes race.
    (set -C; openssl rand -hex 32 > secrets/postgres_password)
    echo 'Database secret created.'
fi
chmod 700 secrets
chmod 600 secrets/postgres_password
if [ ! -e secrets/runtime_password ]; then
    (set -C; openssl rand -hex 32 > secrets/runtime_password)
fi
test -s secrets/runtime_password
# Host directory remains private (0700); the bind-mounted file must be readable
# by the non-root API user inside its container.
chmod 444 secrets/runtime_password
# Signs expiring document links sent over WhatsApp.
if [ ! -e secrets/document_signing_key ]; then
    (set -C; openssl rand -hex 32 > secrets/document_signing_key)
fi
test -s secrets/document_signing_key
# Fonnte token is supplied by the owner on the host; an empty file disables delivery.
[ -e secrets/fonnte_token ] || : > secrets/fonnte_token
chmod 444 secrets/document_signing_key secrets/fonnte_token
