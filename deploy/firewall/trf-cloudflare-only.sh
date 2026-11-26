#!/bin/sh
# Accept web traffic on the Docker-published ports 80/443 only from Cloudflare, so nobody can
# bypass Cloudflare (WAF, rate limits) or spoof CF-Connecting-IP by calling the origin directly.
# Docker-published ports skip ufw, so the filter lives in the DOCKER-USER chain.
# Installed as /usr/local/sbin/trf-cloudflare-only and run at boot by trf-cloudflare-only.service.
# Idempotent: safe to run again. Ranges from https://www.cloudflare.com/ips (checked 2026-11-26);
# update them here when Cloudflare announces a change.
set -eu

IFACE=${IFACE:-eth0}
CHAIN=TRF-CLOUDFLARE
V4="173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22"
V6="2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32"

apply() {
  tool=$1; shift
  $tool -N "$CHAIN" 2>/dev/null || $tool -F "$CHAIN"
  for range in "$@"; do $tool -A "$CHAIN" -s "$range" -j RETURN; done
  $tool -A "$CHAIN" -j DROP
  for proto in tcp udp; do
    $tool -C DOCKER-USER -i "$IFACE" -p "$proto" -m multiport --dports 80,443 -j "$CHAIN" 2>/dev/null       || $tool -I DOCKER-USER -i "$IFACE" -p "$proto" -m multiport --dports 80,443 -j "$CHAIN"
  done
}

# shellcheck disable=SC2086
apply iptables $V4
# shellcheck disable=SC2086
if ip6tables -n -L DOCKER-USER > /dev/null 2>&1; then apply ip6tables $V6; fi
echo "Ports 80/443 on $IFACE accept Cloudflare only."
