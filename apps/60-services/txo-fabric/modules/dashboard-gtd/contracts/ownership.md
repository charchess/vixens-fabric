# Dashboard GTD ownership contract

- Every GTD record has one immutable owning user principal.
- A request must authorize every read, list, write, export and delete operation.
- Tenant membership does not grant access to another user's GTD records.
- Activation and revocation are explicit per-user state transitions.
- A future implementation must define retention, export and deletion semantics
  before storing user content.
