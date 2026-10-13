# NAS-root staging configuration

Upload `docker-compose.nas-staging.yml` from this directory as
`/volume1/docker/homeland/source/docker-compose.yml` for the existing
`homeland_nas_staging` Container Manager project. DSM reads that active filename;
uploading only `docker-compose.nas-staging.yml` does not replace the project file.
It is a root-copy artifact, not a Compose file to run from this nested local
directory. Its `context: .` and `./tai-lieu` paths resolve against the repository
root on NAS. The canonical local file one directory up uses `context: ../..`.

After upload, reload DSM and verify the full YAML before choosing Build. Build
also recreates/starts the project; trigger it once and inspect its result rather
than retrying because a QuickConnect terminal temporarily stops updating.

Candidate metadata must match the reviewed source commit via the NAS `.env`.
Staging credentials remain in the NAS project environment, never in Git.
The `db_v3` volume preserves both older staging volumes without deleting them.

`NAS_STAGING` initializes a confirmed empty database once. Subsequent recreates
only audit exact release history/checksums and the pinned full schema fingerprint;
they never apply SQL or reseed. A completion audit marker is written only after
successful seed; a missing marker, partial history or drift blocks startup. Never use
this for production or conceal migration failure with resolve/reset.

API/database/Redis are internal-only. Web binds NAS loopback port 3000;
a host-network Cloudflare Tunnel can use `http://127.0.0.1:3000` after readiness
and identity gates. Never change a shared tunnel serving unrelated applications.

Do not route Cloudflare traffic until bootstrap succeeds and API/Web readiness,
build identity, staging database identity and disabled provider delivery are
verified. A successful build is not an A-Z UAT or production approval.
