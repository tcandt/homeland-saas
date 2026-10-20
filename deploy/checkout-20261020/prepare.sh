#!/bin/sh
set -eu
umask 077
r=/volume1/docker/homeland/release-4fc77db1/checkout-87aa2457
d=/usr/local/bin/docker
oldpg=homeland_release_320_postgres
newpg=homeland_checkout_87aa2457_postgres
cd "$r"
test "$(stat -c '%a' "$r")" = 700
test "$(cat build.exit)" = 0
test ! -e prepare.started
test ! -e compose.private.json
for file in config.cjs data.cjs assets.cjs prepare.sh; do sha256sum "$file"; done
date -u '+%Y-%m-%dT%H:%M:%SZ' > prepare.started
trap 'result=$?; printf "%s\n" "$result" > prepare.exit' EXIT
"$d" inspect homeland_release_320_api homeland_release_320_worker homeland_release_320_web "$oldpg" homeland_release_320_redis > source-inspect.private.json
api=$(cat api-image.id)
"$d" run --rm --network none --user 0:0 --entrypoint node -v "$r:/release" "$api" /release/config.cjs
compose() { "$d" compose -f "$r/compose.private.json" "$@"; }
compose config --quiet
for volume in database storage runtime; do
  name="homeland_checkout_87aa2457_$volume"
  if "$d" volume inspect "$name" >/dev/null 2>&1; then echo 'Refusing existing candidate volume'; exit 1; fi
  "$d" volume create "$name" >/dev/null
done
compose up -d postgres redis
n=0
until test "$("$d" inspect "$newpg" --format '{{.State.Health.Status}}')" = healthy; do
  n=$((n+1)); test "$n" -le 60; sleep 2
done
test "$("$d" exec "$newpg" psql -U homeland_staging -d homeland_staging -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")" = 0
# Quiesce only the source API/worker so all retained configuration exports agree.
source_stopped=true
recover_source() {
  result=$?
  if test "$source_stopped" = true; then "$d" start homeland_release_320_api homeland_release_320_worker >/dev/null; fi
  printf '%s\n' "$result" > prepare.exit
}
trap recover_source EXIT
"$d" stop homeland_release_320_worker homeland_release_320_api >/dev/null
"$d" exec "$oldpg" pg_dump -U homeland_staging -d homeland_staging -Fc > source-full.private.dump
"$d" exec "$oldpg" pg_dump -U homeland_staging -d homeland_staging --schema-only --no-owner --no-privileges > source-schema.sql
"$d" exec "$oldpg" pg_dump -U homeland_staging -d homeland_staging --data-only --no-owner --no-privileges \
  -t '"TenantOrg"' -t '"Owner"' -t '"User"' -t '"Role"' -t '"Permission"' -t '"UserRole"' -t '"RolePermission"' \
  -t '"AppSetting"' -t '"ChartOfAccount"' -t '"CashAccount"' -t '"BankAccount"' \
  -t '"NotificationTemplate"' -t '"NotificationTemplateVersion"' -t '"NotificationPreference"' \
  -t '"AiPromptTemplate"' -t '"AiModelConfig"' -t '"DocumentTemplate"' -t _prisma_migrations > retained.private.sql
# Run against the old database using the original API environment without starting its server.
"$d" run --rm --network homeland_release_320_default --user 0:0 --entrypoint node \
  --env-file /root/homeland-release-320/connections-eb3ca602.env \
  -e DATABASE_URL="$("$d" inspect homeland_release_320_api --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^DATABASE_URL=//p')" \
  -v "$r:/release" "$api" /release/data.cjs capture > retained-summary.json
"$d" run --rm --network none --user 0:0 --entrypoint node -v "$r:/release" \
  -v homeland_release_320_storage:/source:ro -v homeland_checkout_87aa2457_storage:/target \
  "$api" /release/assets.cjs copy > settings-assets.json
"$d" start homeland_release_320_api homeland_release_320_worker >/dev/null
source_stopped=false
"$d" exec -i "$newpg" psql -v ON_ERROR_STOP=1 -U homeland_staging -d homeland_staging --single-transaction < source-schema.sql > restore-schema.log 2>&1
"$d" exec -i "$newpg" psql -v ON_ERROR_STOP=1 -U homeland_staging -d homeland_staging --single-transaction < retained.private.sql > restore-retained.log 2>&1
"$d" run --rm --network homeland_checkout_87aa2457_default --env-file "$r/api.private.env" --user 0:0 \
  --entrypoint node -v "$r:/release" "$api" /release/data.cjs restore-mappings > restore-mappings.log 2>&1
"$d" run --rm --network homeland_checkout_87aa2457_default --env-file "$r/api.private.env" \
  --entrypoint node "$api" node_modules/prisma/build/index.js migrate deploy --schema=packages/database/prisma/schema.prisma > migrate.log 2>&1
"$d" run --rm --network homeland_checkout_87aa2457_default --env-file "$r/api.private.env" --user 0:0 \
  --entrypoint node -v "$r:/release" "$api" /release/data.cjs verify-target > target-verification.json
compose up -d api web
for name in homeland_checkout_87aa2457_api homeland_checkout_87aa2457_web; do
  n=0
  until test "$("$d" inspect "$name" --format '{{.State.Health.Status}}')" = healthy; do
    n=$((n+1)); test "$n" -le 90; sleep 2
  done
done
echo PRIVATE_CANDIDATE_READY_OLD_DATABASE_UNCHANGED
