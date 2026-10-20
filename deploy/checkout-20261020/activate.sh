#!/bin/sh
set -eu
umask 077
r=/volume1/docker/homeland/release-4fc77db1/checkout-87aa2457
d=/usr/local/bin/docker
cd "$r"
test "$(cat build.exit)" = 0
test "$(cat prepare.exit)" = 0
test ! -e activation.started
api=$(cat api-image.id)
compose() { "$d" compose -f "$r/compose.private.json" "$@"; }
probe() {
  "$d" run --rm --network homeland_checkout_87aa2457_default --env-file "$r/api.private.env" \
    --user 0:0 --entrypoint node -v "$r:/release:ro" "$api" /release/smoke.cjs "$1"
}
verify_target() {
  "$d" run --rm --network homeland_checkout_87aa2457_default --env-file "$r/api.private.env" \
    --user 0:0 --entrypoint node -v "$r:/release:ro" "$api" /release/data.cjs verify-target
}
"$d" run --rm --network none --user 0:0 --entrypoint node -v "$r:/release:ro" "$api" -e '
const a=require("assert/strict"),g=require("/release/ci-gate.json");
a.equal(g.sha,"87aa24573fe3d7e0a5bbea7a44d042cf854c4e5d");a.equal(g.conclusion,"success");
for(const name of ["Lint","Type Check","Unit Test","Integration Test","Build Web","Build API","Security & Supply Chain Scan","E2E Tests"]){a.equal(g.jobs.find(x=>x.name===name)?.conclusion,"success",name)}
'
probe http://web:3000 > private-smoke.json
verify_target > pre-activation-target.json
date -u '+%Y-%m-%dT%H:%M:%SZ' > activation.started
source_stopped=false
committed=false
recover() {
  result=$?
  if test "$committed" = false && test "$source_stopped" = true; then
    "$d" stop homeland_checkout_87aa2457_worker homeland_checkout_87aa2457_api homeland_checkout_87aa2457_web >/dev/null 2>&1 || true
    "$d" start homeland_release_320_api homeland_release_320_worker homeland_release_320_web >/dev/null
    echo SOURCE_TRAFFIC_RESTORED
  fi
  printf '%s\n' "$result" > activate.exit
}
trap recover EXIT
source_stopped=true
"$d" stop homeland_release_320_worker homeland_release_320_api >/dev/null
"$d" run --rm --network homeland_release_320_default --user 0:0 --entrypoint node \
  -e DATABASE_URL="$("$d" inspect homeland_release_320_api --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^DATABASE_URL=//p')" \
  -v "$r:/release:ro" "$api" /release/data.cjs verify-source > source-freshness.txt
"$d" run --rm --network none --user 0:0 --entrypoint node -v "$r:/release:ro" \
  -v homeland_release_320_storage:/source:ro -v homeland_checkout_87aa2457_storage:/target:ro \
  "$api" /release/assets.cjs verify > assets-freshness.json
"$d" stop homeland_release_320_web >/dev/null
"$d" run --rm --network none --user 0:0 --entrypoint node -v "$r:/release" "$api" -e '
const fs=require("fs"),a=require("assert/strict"),p="/release/compose.private.json",c=JSON.parse(fs.readFileSync(p));
a.deepEqual(c.services.web.ports,["127.0.0.1:3004:3000"]);c.services.web.ports=["127.0.0.1:3002:3000"];
fs.writeFileSync(p,JSON.stringify(c,null,2),{mode:0o600});
'
# Once publication starts, the new database is authoritative. Never roll back
# automatically after a real user could have received a successful write.
committed=true
compose up -d --no-deps web
n=0
until test "$("$d" inspect homeland_checkout_87aa2457_web --format '{{.State.Health.Status}}')" = healthy; do
  n=$((n+1)); test "$n" -le 90; sleep 2
done
probe https://homeland.ductinh.one > https-smoke.json
verify_target > post-activation-target.json
compose up -d --no-deps notification_worker
for name in homeland_checkout_87aa2457_api homeland_checkout_87aa2457_web homeland_checkout_87aa2457_worker; do
  test "$("$d" inspect "$name" --format '{{.State.Status}}')" = running
  test "$("$d" inspect "$name" --format '{{.RestartCount}}')" = 0
done
echo CHECKOUT_DEPLOYMENT_PASS_OLD_DATABASE_AND_VOLUMES_PRESERVED
