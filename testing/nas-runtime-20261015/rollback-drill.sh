#!/bin/sh
set -eu

drill_dir=/volume1/docker/homeland/staging-e9e24274
drill_pg=homeland_restore_drill_20261015_pg
drill_image=homeland-api:3.0.2-573bc663

checkpoint() {
  docker run --rm --network "container:$drill_pg" --env-file "$drill_dir/.env" \
    -e DRILL_VARIANT=fresh -e "AUDIT_LABEL=$1" \
    --mount "type=bind,src=$drill_dir/restore-audit.cjs,dst=/drill.cjs,readonly" \
    --mount "type=bind,src=$drill_dir/drill-20261015,dst=/drill-output" \
    --entrypoint node "$drill_image" /drill.cjs checkpoint
}

launch() {
  docker run -d --name "homeland_restore_drill_20261015_$1" \
    --network "container:$drill_pg" --memory 768m --env-file "$drill_dir/drill-private-20261015/env" -e DRILL_VARIANT=fresh \
    --mount "type=bind,src=$drill_dir/restore-audit.cjs,dst=/drill.cjs,readonly" \
    --mount type=volume,src=homeland_restore_drill_storage_20261015,dst=/app/apps/api/storage \
    --entrypoint node "$2" /drill.cjs launch >/dev/null
  attempt=0
  until docker exec "homeland_restore_drill_20261015_$1" node -e \
    'fetch("http://127.0.0.1:3001/api/v1/health/ready",{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 60 ]; then
      echo "FAIL application readiness: $1"
      exit 1
    fi
    sleep 1
  done
  echo "PASS application readiness: $1"
}

smoke() {
  docker run --rm --network "container:$drill_pg" --env-file "$drill_dir/.env" \
    -e DRILL_VARIANT=fresh -e "DRILL_PHASE=$1" -e "EXPECTED_DRILL_COMMIT=$2" \
    --mount "type=bind,src=$drill_dir/restore-audit.cjs,dst=/drill.cjs,readonly" \
    --mount "type=bind,src=$drill_dir/drill-20261015,dst=/drill-output" \
    --entrypoint node "$drill_image" /drill.cjs smoke
}

test "$(docker image inspect "$drill_image" --format '{{.Id}}')" = sha256:281deb6e3f2baa3a40d55cf143b156c5455efa8777640d7462c93acdb9190579
test "$(docker image inspect homeland-api:3.0.2-e9e24274 --format '{{.Id}}')" = sha256:e9d54c2097dde33a37e852b05efa03a860794c2289ded5d228d7d38ae77f6fa0
test "$(docker inspect "$drill_pg" --format '{{.HostConfig.NetworkMode}}')" = none

checkpoint baseline
launch current "$drill_image"
checkpoint current-started
smoke current 573bc6636266313a04cb2d7b1fbcdef3223eec7b
checkpoint current-tested
docker stop -t 15 homeland_restore_drill_20261015_current >/dev/null
rollback_start=$(date +%s)
launch rollback homeland-api:3.0.2-e9e24274
checkpoint rollback-started
smoke rollback e9e242741a556822abe2febcb61fb80824c5e236
checkpoint rollback-tested
echo "PASS isolated API rollback seconds=$(( $(date +%s) - rollback_start ))"
docker stop -t 15 homeland_restore_drill_20261015_rollback >/dev/null
launch forward "$drill_image"
checkpoint forward-started
smoke forward 573bc6636266313a04cb2d7b1fbcdef3223eec7b
checkpoint forward-tested
docker stop -t 15 homeland_restore_drill_20261015_forward >/dev/null
echo 'PASS isolated API rollback/forward drill; no public staging switch or migration apply'
