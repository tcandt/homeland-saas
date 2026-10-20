#!/bin/sh
set -eu
umask 077
r=/volume1/docker/homeland/release-4fc77db1/checkout-87aa2457
d=/usr/local/bin/docker
sha=87aa24573fe3d7e0a5bbea7a44d042cf854c4e5d
cd "$r"
test ! -e build.exit
test ! -e context
test "$(sha256sum source.tar | cut -d ' ' -f 1)" = "$1"
test "$(df -Pk "$r" | awk 'END {print $4}')" -ge 16777216
mkdir build.lock
trap 'result=$?; printf "%s\n" "$result" > build.exit' EXIT
echo $$ > build.pid
mkdir context security security/input security/reports
tar -xf source.tar -C context
for role in api web; do
  "$d" build -f "context/Dockerfile.$role" --build-arg COMMIT_SHA="$sha" \
    --build-arg VERSION=3.2.0 --build-arg BUILD_ID=checkout-87aa2457 \
    --build-arg BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    -t "homeland-$role:3.2.0-checkout-87aa2457" context > "build-$role.log" 2>&1
  "$d" image inspect "homeland-$role:3.2.0-checkout-87aa2457" --format '{{.Id}}' > "$role-image.id"
done
scanner=aquasec/trivy@sha256:be1190afcb28352bfddc4ddeb71470835d16462af68d310f9f4bca710961a41e
cache=homeland_release_320_scan_cache_836d0af2
"$d" run --rm --network none --entrypoint cat -v "$cache:/root/.cache/trivy:ro" "$scanner" /root/.cache/trivy/db/metadata.json > security/reports/database-metadata.json
for role in api web; do
  image=$(cat "$role-image.id")
  "$d" image save --output "security/input/$role.tar" "$image"
  "$d" run --rm --network none --name "homeland_checkout_${role}_scan" \
    -v "$cache:/root/.cache/trivy" -v "$r/security/input:/input:ro" -v "$r/security/reports:/reports" \
    "$scanner" image --input "/input/$role.tar" --offline-scan --skip-db-update --skip-java-db-update \
    --scanners vuln,secret --pkg-types os,library --format json --output "/reports/$role-trivy.json" \
    --timeout 20m > "security/reports/$role-scan.log" 2>&1
  "$d" run --rm --network none --user 0:0 --entrypoint node -v "$r/security/reports:/reports:ro" "$image" -e '
const fs=require("fs"),a=require("assert/strict"),r=JSON.parse(fs.readFileSync("/reports/"+process.argv[1]+"-trivy.json")),m=require("/reports/database-metadata.json");
a.ok(Date.now()-Date.parse(m.UpdatedAt)<48*3600000);a.equal(r.SchemaVersion,2);a.equal(r.Metadata.ImageID,process.argv[2]);
a.ok(r.Results.some(x=>x.Class==="os-pkgs"));a.ok(r.Results.some(x=>x.Class==="lang-pkgs"));
const v=r.Results.flatMap(x=>x.Vulnerabilities||[]),s=r.Results.flatMap(x=>x.Secrets||[]),counts=Object.fromEntries(["CRITICAL","HIGH","MEDIUM","LOW","UNKNOWN"].map(k=>[k,v.filter(x=>x.Severity===k).length]));
a.equal(counts.CRITICAL+counts.HIGH,0);a.equal(s.length,0);console.log(JSON.stringify({image:r.Metadata.ImageID,counts,secrets:s.length}));
' "$role" "$image" > "security/$role-summary.json" 2>&1
done
echo CHECKOUT_BUILD_SECURITY_PASS
