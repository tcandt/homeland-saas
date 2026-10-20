#!/bin/sh
set -eu
umask 077
r=/volume1/docker/homeland/release-4fc77db1/checkout-87aa2457
cd "$r"
test "$(cat build.exit)" = 0
test ! -e runtime.started
date -u '+%Y-%m-%dT%H:%M:%SZ' > runtime.started
trap 'result=$?; printf "%s\n" "$result" > runtime.exit' EXIT
export PATH=/usr/local/bin:$PATH
node=/var/packages/Node.js_v22/target/usr/local/bin/node
VERIFY_DISPOSABLE_WEB_IMAGE=true "$node" context/scripts/verify-web-runtime-image.js "$(cat web-image.id)" 87aa24573fe3d7e0a5bbea7a44d042cf854c4e5d > runtime-web.log 2>&1
VERIFY_DISPOSABLE_NAS_IMAGE=true "$node" context/scripts/verify-nas-bootstrap-image.js "$(cat api-image.id)" > runtime-api.log 2>&1
echo NAS_ACTUAL_IMAGE_RUNTIME_PASS
