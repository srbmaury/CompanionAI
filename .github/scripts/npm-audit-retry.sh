#!/usr/bin/env bash
set -u

attempts="${NPM_AUDIT_RETRIES:-3}"
delay="${NPM_AUDIT_RETRY_DELAY_SECONDS:-10}"

for attempt in $(seq 1 "$attempts"); do
  output_file="$(mktemp)"
  set +e
  npm audit "$@" 2>&1 | tee "$output_file"
  status=${PIPESTATUS[0]}
  set -e

  if [ "$status" -eq 0 ]; then
    rm -f "$output_file"
    exit 0
  fi

  if grep -Eqi '503 Service Unavailable|502 Bad Gateway|504 Gateway Timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|audit endpoint returned an error|fetch failed|network error' "$output_file"; then
    rm -f "$output_file"
    if [ "$attempt" -lt "$attempts" ]; then
      echo "npm audit registry/network failure on attempt $attempt/$attempts; retrying in ${delay}s..."
      sleep "$delay"
      delay=$((delay * 2))
      continue
    fi
  else
    rm -f "$output_file"
    exit "$status"
  fi

done

echo "npm audit could not reach the registry after $attempts attempts."
exit 1
