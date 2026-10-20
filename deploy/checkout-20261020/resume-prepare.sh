#!/bin/sh
set -eu
umask 077
r=/volume1/docker/homeland/release-4fc77db1/checkout-87aa2457
d=/usr/local/bin/docker
cd "$r"
test "$(stat -c '%a' "$r")" = 700
test "$(cat prepare.exit)" = 1
test ! -e resume.started
test ! -e migrate.log
test "$(cat runtime.exit)" = 0
test "$(cat build.exit)" = 0
test "$("$d" exec homeland_checkout_87aa2457_postgres psql -U homeland_staging -d homeland_staging -Atc 'SELECT count(*) FROM "HunonicMeterMapping"')" = 0
date -u '+%Y-%m-%dT%H:%M:%SZ' > resume.started
trap 'result=$?; printf "%s\n" "$result" > prepare.exit' EXIT
api=$(cat api-image.id)
"$d" run --rm --network homeland_checkout_87aa2457_default --env-file "$r/api.private.env" --user 0:0 \
  --entrypoint node -v "$r:/release" "$api" /release/data.cjs restore-mappings > restore-mappings-retry.log 2>&1
"$d" run --rm --network homeland_checkout_87aa2457_default --env-file "$r/api.private.env" \
  --entrypoint node "$api" node_modules/prisma/build/index.js migrate deploy --schema=packages/database/prisma/schema.prisma > migrate.log 2>&1
"$d" run --rm --network homeland_checkout_87aa2457_default --env-file "$r/api.private.env" --user 0:0 \
  --entrypoint node -v "$r:/release" "$api" /release/data.cjs verify-target > target-verification.json
"$d" compose -f "$r/compose.private.json" up -d api web
for name in homeland_checkout_87aa2457_api homeland_checkout_87aa2457_web; do
  n=0
  until test "$("$d" inspect "$name" --format '{{.State.Health.Status}}')" = healthy; do
    n=$((n+1)); test "$n" -le 90; sleep 2
  done
done
echo PRIVATE_CANDIDATE_READY_OLD_DATABASE_UNCHANGED
