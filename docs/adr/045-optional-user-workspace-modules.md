# ADR-045: Optional user and workspace modules

## Status

Accepted as a source-only catalogue contract. No runtime is activated by this ADR.

## Context

TXO Fabric needs optional product capabilities without creating parallel logins,
parallel authorization paths, or broad filesystem access. The historical hAIrem
Dashboard, wiki/viewer and FileBrowser are not deployment templates.

## Decision

Optional modules live under:

```text
apps/60-services/txo-fabric/modules/<module-name>/
```

A module is absent and inactive by default. A module must be integrated through
the Fabric WebUI/session path and perform authorization using the canonical
immutable principal, tenant resolution and Fabric policy boundary. Modules do
not introduce a separate public service, login or unmanaged credentials.

Every module starts with a README, a capability/ownership contract and an
isolation test plan. A deployment manifest, storage resource, external route or
controller is added only in a separately reviewed implementation change.

The initial catalogue is:

- `dashboard-gtd`: user-owned GTD records;
- `llmwiki`: user-owned Markdown knowledge workspace experience;
- `filebrowser`: explicitly scoped workspace browsing, never a broad host or
  tenant filesystem mount.

## Consequences

- The historical `charchess/vixens` cockpit remains retired and is not revived.
- Markdown remains the provisional source of truth for `llmwiki`; an eventual
  index, graph or semantic layer is derived and disposable until a dedicated ADR
  changes this decision.
- `filebrowser` must receive an explicit scope contract before it has a UI or
  backend. Path strings alone never authorize access.
- Module activation, revocation, data retention and deletion are product and
  security decisions that require module-specific design and tests.
