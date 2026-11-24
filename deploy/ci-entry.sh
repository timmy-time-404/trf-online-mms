#!/bin/sh
# Forced command for the GitHub Actions deploy key (see docs/deployment.md).
# The key can do exactly two things, whatever command the client asks for:
#   ssh <host> "release <tag>" < release.tar.gz
#   ssh <host> "rollback <tag>"
set -eu
set -- ${SSH_ORIGINAL_COMMAND:-}
action=${1:-}
tag=${2:-}
case "$action" in
  release)
    archive=$(mktemp /tmp/trf-release-XXXXXX.tar.gz)
    trap 'rm -f "$archive"' EXIT
    cat > "$archive"
    sh /opt/trf-dev/foundation/deploy/release.sh release "$tag" "$archive"
    ;;
  rollback)
    sh /opt/trf-dev/foundation/deploy/release.sh rollback "$tag"
    ;;
  *)
    echo "Only 'release <tag>' and 'rollback <tag>' are allowed." >&2
    exit 2
    ;;
esac
