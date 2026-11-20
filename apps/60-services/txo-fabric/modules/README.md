# Optional TXO Fabric modules

This catalogue contains source-only module contracts. A directory here is not a
deployment, an enabled feature, a Kubernetes resource or a permission grant.

Each module must integrate with the existing Fabric WebUI/session and authorization
boundaries. It may not add a separate login, public backend, unmanaged secret or
broad filesystem mount.

See [`docs/adr/045-optional-user-workspace-modules.md`](../../../../../docs/adr/045-optional-user-workspace-modules.md).
