#!/bin/sh
# Auto-provision the secrets temetro needs, so `docker compose up` works with
# zero manual setup. Any secret not supplied via the environment is generated
# and persisted to a Docker volume, so it stays stable across restarts (which
# matters: rotating BETTER_AUTH_SECRET logs everyone out, and rotating
# AI_CREDENTIALS_KEY invalidates stored AI provider keys).
#
# Precedence for each secret: a real value you pass in (.env / compose) wins;
# otherwise a previously generated one is reused; otherwise a new one is made.
set -e

SECRETS_FILE="${SECRETS_FILE:-/var/lib/temetro/secrets.env}"
mkdir -p "$(dirname "$SECRETS_FILE")"
touch "$SECRETS_FILE"

# 32 random bytes, base64 — no openssl dependency (busybox has base64).
random_secret() {
  head -c 32 /dev/urandom | base64 | tr -d '\n'
}

ensure_secret() {
  name="$1"
  current="$(printenv "$name" || true)"
  case "$current" in
    "" | dev-insecure-* | replace-me-*)
      saved="$(grep "^${name}=" "$SECRETS_FILE" 2>/dev/null | tail -n1 | cut -d= -f2-)"
      if [ -n "$saved" ]; then
        export "$name=$saved"
      else
        val="$(random_secret)"
        export "$name=$val"
        printf '%s=%s\n' "$name" "$val" >>"$SECRETS_FILE"
        echo "🔑 Generated $name (persisted; stable across restarts)"
      fi
      ;;
  esac
}

ensure_secret BETTER_AUTH_SECRET
ensure_secret AI_CREDENTIALS_KEY

exec "$@"
