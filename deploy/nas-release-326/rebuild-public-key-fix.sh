#!/bin/sh
set -eu
umask 077
r=/volume1/docker/homeland/release-326-20261021
cd "$r"
test ! -e activation.started
test ! -e attempt-25ffc456
test "$(sha256sum source-r2.tar | cut -d ' ' -f 1)" = cd31a279fae8cf4dda57c5b0003eb5f9fdae1b823823496390f130319b025568
while test ! -s build.exit; do sleep 10; done
test "$(cat source.sha)" = 25ffc456083d965f5aeb9543ca57acea2c920603
mkdir attempt-25ffc456
for item in context security source.tar source.sha api-image.id web-image.id build-api.log build-web.log build.exit build.lock launch.log runtime-api.log runtime-web.log; do
  if test -e "$item"; then mv "$item" "attempt-25ffc456/$item"; fi
done
cp source-r2.tar source.tar
exec sh build.sh 8f5270358dea359e839edf601a8945298d1f2830 cd31a279fae8cf4dda57c5b0003eb5f9fdae1b823823496390f130319b025568
