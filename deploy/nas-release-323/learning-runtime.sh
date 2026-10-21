#!/bin/sh
set -eu
r=/volume1/docker/homeland/release-323-20261021
d=/usr/local/bin/docker
name=homeland_322_learning_probe
image=$(cat "$r/web-image.id")
test -z "$("$d" ps -aq --filter "name=^${name}$")"
created=false
cleanup() {
  result=$?
  if test "$created" = true; then "$d" rm -f "$name" >/dev/null; fi
  exit "$result"
}
trap cleanup EXIT
"$d" create --name "$name" --network none --add-host api:127.0.0.1 "$image" >/dev/null
created=true
"$d" start "$name" >/dev/null
"$d" exec "$name" node -e '
const a=require("assert/strict"),fs=require("fs");
(async()=>{
  a.equal(process.getuid(),1001);
  let snapshot;
  for(let i=0;i<60;i++){
    try { snapshot=await fetch("http://127.0.0.1:3000/api/learning/v1/snapshot"); if(snapshot.status===200)break; }catch{}
    await new Promise(r=>setTimeout(r,1000));
  }
  a.equal(snapshot.status,200);
  const response=await fetch("http://127.0.0.1:3000/api/learning/v1/samples",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({samples:[{kind:"qr",payload:{x:0.8,y:0.2,span:0.1,source:"zxing"}}]})});
  a.equal(response.status,202);
  const body=await response.json();a.equal(body.accepted,1);a.equal(body.rejected,0);
  const file="/app/apps/web/.local-data/learning/samples.ndjson";
  a.ok(fs.existsSync(file));a.equal(fs.statSync(file).uid,1001);
  console.log(JSON.stringify({status:"PASS",nonRoot:1001,snapshot:200,sample:202,accepted:1,primaryStorageWritable:true,liveDataUntouched:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
'
