# Fabric audit sink retention, rotation and fail-closed boundary

## Scope

This contract covers only the dedicated persistent storage mounted at `/openbao/audit`. It does not enable, configure or call an OpenBao audit API.

## Retention

- `openbao-fabric-audit` is distinct from the Raft claim and uses `storage-rwo-retain` with `ReadWriteOnce` access.
- ArgoCD must not prune or delete the claim (`Prune=false,Delete=false`).
- Capacity starts at 5Gi. Any expansion requires a reviewed Git change and a storage-capacity assessment.
- The Raft claim, `/openbao/data`, Raft snapshots and restore boundary are outside this contract.

## Activation and rotation

- Audit-device registration and rotation are post-unseal runtime operations owned by Electra.
- Git must never contain an audit event, audit payload, token, key, Secret value, API request or audit-device command.
- Rotation evidence is limited to non-sensitive readiness/status and storage-capacity metadata.

## Fail-closed and rollback

- Do not qualify an audit sink if its dedicated claim is absent, unbound, mounted read-only, substituted with Raft storage, or cannot accept writes.
- Do not activate a bridge, BFF, consumer or privileged path based on audit storage alone.
- Before changing persistent audit storage, Electra must disable the runtime audit device through the approved runtime procedure; no GitOps delete, PVC substitution or Raft-volume action is a rollback.
