#!/bin/sh
set -eu
umask 077
r=/volume1/docker/homeland/release-326-20261021
d=/usr/local/bin/docker
sha=$1
archive_hash=$2
cd "$r"
test ! -e build.exit
test ! -e context
test "$(sha256sum source.tar | cut -d ' ' -f 1)" = "$archive_hash"
# Git's archive provenance must name the same commit that passed CI, not just
# an arbitrary digest supplied alongside an arbitrary build identity.
test "$("$d" run --rm -i --network none --entrypoint git sha256:8f99a37dc3fb23c2cef11d1fc93966447f0dc42a20b7fe0931fc9591a8760d1b get-tar-commit-id < source.tar)" = "$sha"
test "$(df -Pk "$r" | awk 'END {print $4}')" -ge 16777216
mkdir build.lock
trap 'result=$?; printf "%s\n" "$result" > build.exit' EXIT
mkdir context security security/input security/reports
tar -xf source.tar -C context
test "$(/var/packages/Node.js_v22/target/usr/local/bin/node -p 'require("./context/package.json").version')" = 3.2.6
printf '%s\n' "$sha" > source.sha
for role in api web; do
  "$d" build -f "context/Dockerfile.$role" --build-arg COMMIT_SHA="$sha" \
    --build-arg VERSION=3.2.6 --build-arg BUILD_ID=nas-3.2.6 \
    --build-arg BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    -t "homeland-$role:3.2.6-${sha}" context > "build-$role.log" 2>&1
  "$d" image inspect "homeland-$role:3.2.6-${sha}" --format '{{.Id}}' > "$role-image.id"
done
scanner=aquasec/trivy@sha256:be1190afcb28352bfddc4ddeb71470835d16462af68d310f9f4bca710961a41e
cache=homeland_release_320_scan_cache_836d0af2
"$d" run --rm -v "$cache:/root/.cache/trivy" "$scanner" image --download-db-only > security/reports/database-update.log 2>&1
"$d" run --rm --network none --entrypoint cat -v "$cache:/root/.cache/trivy:ro" "$scanner" /root/.cache/trivy/db/metadata.json > security/reports/database-metadata.json
for role in api web; do
  image=$(cat "$role-image.id")
  "$d" image save --output "security/input/$role.tar" "$image"
  "$d" run --rm --network none -v "$cache:/root/.cache/trivy" \
    -v "$r/security/input:/input:ro" -v "$r/security/reports:/reports" \
    "$scanner" image --input "/input/$role.tar" --offline-scan --skip-db-update --skip-java-db-update \
    --scanners vuln,secret --pkg-types os,library --format json --output "/reports/$role-trivy.json" \
    --timeout 20m > "security/reports/$role-scan.log" 2>&1
  "$d" run --rm --network none --user 0:0 --entrypoint node -v "$r/security/reports:/reports:ro" "$image" -e '
const fs=require("fs"),a=require("assert/strict"),r=require("/reports/"+process.argv[1]+"-trivy.json"),m=require("/reports/database-metadata.json");
a.ok(Date.now()-Date.parse(m.UpdatedAt)<48*3600000);a.equal(r.Metadata.ImageID,process.argv[2]);
a.ok(r.Results.some(x=>x.Class==="os-pkgs"));a.ok(r.Results.some(x=>x.Class==="lang-pkgs"));
const v=r.Results.flatMap(x=>x.Vulnerabilities||[]),s=r.Results.flatMap(x=>x.Secrets||[]),counts=Object.fromEntries(["CRITICAL","HIGH","MEDIUM","LOW","UNKNOWN"].map(k=>[k,v.filter(x=>x.Severity===k).length]));
a.equal(counts.CRITICAL+counts.HIGH,0);a.equal(s.length,0);console.log(JSON.stringify({image:r.Metadata.ImageID,counts,secrets:s.length}));
' "$role" "$image" > "security/$role-summary.json" 2>&1
done
export PATH=/usr/local/bin:$PATH
node=/var/packages/Node.js_v22/target/usr/local/bin/node
VERIFY_DISPOSABLE_WEB_IMAGE=true "$node" context/scripts/verify-web-runtime-image.js "$(cat web-image.id)" "$sha" > runtime-web.log 2>&1
VERIFY_DISPOSABLE_NAS_IMAGE=true "$node" context/scripts/verify-nas-bootstrap-image.js "$(cat api-image.id)" > runtime-api.log 2>&1
echo BUILD_SECURITY_RUNTIME_PASS
