# POC debt — Fabric BFF ESO provider policy

Status: active POC exception
Owner: Electra
Recorded: 2026-11-25
Mandatory removal deadline: 2026-12-02 (seven calendar days)

## Scope

Only the existing Fabric OpenBao policy `txo-fabric-webui-bff-runtime-eso` is
amended. Its sole active capability is `read` on the exact KV-v2 data path
`fabric/data/vixens/prod/apps/60-services/txo-fabric/webui-bff`.

The policy is consumed only by the pre-existing dedicated token reference
behind the namespace-local SecretStore
`openbao-fabric-webui-bff-runtime-store` and its one ExternalSecret
`txo-fabric-webui-bff-runtime-credentials-dedicated`. It enables only the
BFF runtime username/password projection. It does not grant list, metadata,
write, delete, auth, token, policy, system, sibling-path, namespace-wide, or
cluster-wide access.

## Why this exception exists

The deployed policy previously allowed a different, inactive provider path.
The dedicated ExternalSecret therefore received OpenBao `403 permission
denied`, leaving the MVP browser BFF on its placeholder. The POC needs the
already declared record path to be readable while the durable workload-auth
and rotation design is completed.

## Expiration and removal

Automatic expiry is unavailable for this amendment: the already-installed
provider token is a pre-existing static token and its expiry/rotation is not
owned by GitOps. Issuing or replacing it would require a separate custody
operation and would enlarge this MVP change.

No later than 2026-12-02, the Fabric custody operator must delete policy
`txo-fabric-webui-bff-runtime-eso` (or replace it with the reviewed dynamic,
short-lived workload identity policy), then verify the dedicated
ExternalSecret is no longer using this POC access. Revert the accompanying
BFF MVP release via the previous immutable `prod-v` tag if the POC is being
withdrawn before replacement is ready. The existing static token reference
must never be reused for another consumer.

## Verification required while active

1. The policy contains exactly one path stanza and exactly `read`.
2. The named ExternalSecret is `Ready=True`; no other ExternalSecret may use
   the dedicated store.
3. Argo reports the Fabric application `Synced/Healthy`, and the BFF flags
   are true only after the runtime and public BFF response are verified.
