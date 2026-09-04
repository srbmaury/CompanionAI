#!/usr/bin/env bash
set -u

attempts="${NPM_AUDIT_RETRIES:-3}"
delay="${NPM_AUDIT_RETRY_DELAY_SECONDS:-10}"
timeout_seconds="${NPM_AUDIT_TIMEOUT_SECONDS:-90}"

for attempt in $(seq 1 "$attempts"); do
  output_file="$(mktemp)"
  set +e
  timeout "${timeout_seconds}s" npm audit "$@" 2>&1 | tee "$output_file"
  status=${PIPESTATUS[0]}
  set -e

  if [ "$status" -eq 0 ]; then
    rm -f "$output_file"
    exit 0
  fi

  transient=false
  if [ "$status" -eq 124 ]; then
    echo "npm audit timed out after ${timeout_seconds}s on attempt $attempt/$attempts."
    transient=true
  elif grep -Eqi '503 Service Unavailable|502 Bad Gateway|504 Gateway Timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|audit endpoint returned an error|fetch failed|network error' "$output_file"; then
    transient=true
  fi

  rm -f "$output_file"

  if [ "$transient" = true ]; then
    if [ "$attempt" -lt "$attempts" ]; then
      echo "npm audit registry/network failure on attempt $attempt/$attempts; retrying in ${delay}s..."
      sleep "$delay"
      delay=$((delay * 2))
      continue
    fi
    break
  fi

  # A non-network npm audit failure is an actual audit finding or command error.
  # Preserve that exit code instead of retrying or masking it.
  exit "$status"
done

echo "npm audit could not reach the registry after $attempts attempts."
exit 1
