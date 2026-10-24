#!/bin/sh
set -eu
umask 077
r=/volume1/docker/homeland/release-3212-20261024
d=/usr/local/bin/docker
node=/var/packages/Node.js_v22/target/usr/local/bin/node
cd "$r"
test "$(cat build.exit)" = 0
test ! -e activation.started
"$node" -e '
const a=require("assert/strict"),fs=require("fs"),g=require("./ci-gate.json");
a.equal(g.sha,fs.readFileSync("source.sha","utf8").trim());a.equal(g.conclusion,"success");
for(const name of ["Lint","Type Check","Unit Test","Integration Test","Build Web","Build API","Security & Supply Chain Scan","E2E Tests"]) a.equal(g.jobs.find(x=>x.name===name)?.conclusion,"success",name);
'
test -s compose.private.json
test -s rollback.private.json
# The exact private configuration must have passed the redacted Compose audit.
sha256sum -c configuration-audit.sha >/dev/null
for file in rollback.private.json compose.private.json api.private.env; do
  /usr/syno/bin/synoacltool -del "$r/$file" >/dev/null 2>&1 || true
  chmod 600 "$r/$file"
done
compose() { "$d" compose -f "$r/compose.private.json" "$@"; }
date -u '+%Y-%m-%dT%H:%M:%SZ' > activation.started
stopped=false
accepted=false
published=false
recover() {
  result=$?
  if test "$stopped" = true && test "$accepted" = false && test "$published" = false; then
    "$d" compose -f "$r/rollback.private.json" up -d --no-deps api web notification_worker > rollback.log 2>&1 || true
  elif test "$published" = true && test "$accepted" = false; then
    # Bounded fail-forward: old billing code cannot interpret newly imported
    # opening balances. Keep the new image set and retry its service startup.
    attempt=0
    while test "$attempt" -lt 2; do
      attempt=$((attempt+1))
      if compose up -d --no-deps api web notification_worker >> fail-forward.log 2>&1; then break; fi
    done
    echo NEW_IMAGE_FAIL_FORWARD_ATTEMPTED >> fail-forward.log
  fi
  printf '%s\n' "$result" > activate.exit
}
trap recover EXIT
stopped=true
# Keep database, Redis and every volume in place. Only application images change.
compose stop notification_worker web api > stop.log 2>&1
"$node" integrity.cjs before
test ! -e before-update.private.dump
touch before-update.private.dump
/usr/syno/bin/synoacltool -del "$r/before-update.private.dump" >/dev/null 2>&1 || true
chmod 600 before-update.private.dump
test "$(stat -c '%a:%u' before-update.private.dump)" = 600:0
"$d" exec homeland_checkout_87aa2457_postgres pg_dump -U homeland_staging -d homeland_staging -Fc > before-update.private.dump
test -s before-update.private.dump
"$d" exec homeland_checkout_87aa2457_postgres psql -U homeland_staging -d homeland_staging -Atc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL' > migration-count.before
test "$(cat migration-count.before)" = 37
compose up -d --no-deps api > start.log 2>&1
for name in homeland_checkout_87aa2457_api; do
  n=0
  until test "$("$d" inspect "$name" --format '{{.State.Health.Status}}')" = healthy; do
    n=$((n+1)); test "$n" -le 90; sleep 2
  done
done
# After publishing, never restore an older application automatically: a real
# user may already have imported opening balances the old code cannot honor.
published=true
compose up -d --no-deps web >> start.log 2>&1
n=0
until test "$("$d" inspect homeland_checkout_87aa2457_web --format '{{.State.Health.Status}}')" = healthy; do
  n=$((n+1)); test "$n" -le 90; sleep 2
done
"$d" run --rm --network homeland_checkout_87aa2457_default --env-file "$r/api.private.env" \
  --user 0:0 --entrypoint node -v "$r:/release:ro" "$(cat api-image.id)" /release/verify.cjs > acceptance.json
"$node" integrity.cjs after > data-preservation.json
compose up -d --no-deps notification_worker > worker-start.log 2>&1
for name in homeland_checkout_87aa2457_api homeland_checkout_87aa2457_web homeland_checkout_87aa2457_worker; do
  test "$("$d" inspect "$name" --format '{{.State.Status}}')" = running
  test "$("$d" inspect "$name" --format '{{.RestartCount}}')" = 0
done
accepted=true
echo RELEASE_3_2_12_ACTIVE_DATABASE_PRESERVED
