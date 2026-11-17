# Fabric audit sink retention, rotation and fail-closed boundary

## Scope

This contract covers only the dedicated persistent storage mounted at `/openbao/audit`. It does not enable, configure or call an OpenBao audit API.

## Ownership and retention

- Electra owns runtime audit-device registration, rotation, retention/archive evidence and recovery decisions after unseal.
- `openbao-fabric-audit` is distinct from the Raft claim and uses `storage-rwo-retain` with `ReadWriteOnce` access.
- ArgoCD must not prune or delete the claim (`Prune=false,Delete=false`).
- Capacity starts at 5Gi. Alert Electra when persistent-volume usage reaches 80%; any expansion requires a reviewed Git change and storage-capacity assessment.
- Retention/archive proof is limited to non-sensitive status, timestamp, capacity and archive-completion metadata; audit events and values are never copied to Git, chat or PR evidence.
- The Raft claim, `/openbao/data`, Raft snapshots and restore boundary are outside this contract.

## Activation and rotation

- Audit-device registration and rotation are post-unseal runtime operations owned by Electra.
- Git must never contain an audit event, audit payload, token, key, Secret value, API request or audit-device command.
- Rotation evidence is limited to non-sensitive readiness/status, capacity and archive-completion metadata.

## Saturation, fail-closed and rollback

- At the 80% alert threshold, Electra investigates retention/archive progress. At saturation, stop audit-dependent qualification and do not activate a bridge, BFF, consumer or privileged path.
- Do not qualify an audit sink if its dedicated claim is absent, unbound, mounted read-only, substituted with Raft storage, or cannot accept writes.
- Before changing persistent audit storage, Electra must disable the runtime audit device through the approved runtime procedure; no GitOps delete, PVC deletion, PVC substitution or Raft-volume action is a rollback.
