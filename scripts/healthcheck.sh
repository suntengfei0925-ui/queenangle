#!/usr/bin/env sh
set -eu

URL="${URL:-http://127.0.0.1:3000/api/health}"

curl -fsS "$URL" >/dev/null
echo "OK $URL"
