# Browser authority binding contract

## Purpose and boundary

This source-only contract specifies the missing authority boundary for a future authenticated browser conversation. No provider implementation. No migration. No BFF activation, workload or runtime action is included. Gates remain false.

All identifiers below are opaque placeholders. They are examples of shape, never promoted identity data.

## Data-authority split

The browser is presentation-only. It can carry an opaque cookie and request a route, but cannot supply identity claims, a tenant authority, a Fabric identity, a thread identifier, an agent incarnation, a binding version, or a policy decision.

The fixed server-owned verifier reads the opaque browser session and returns a `BrowserSessionCapability`. The fixed server route resolver derives the requested route scope. The canonical TenantBundle catalogue, identity-binding ledger, AgentIdentity reader, Client0 membership reader and OpenFGA checker are separate server-owned authorities. Any unavailable, malformed, stale, ambiguous, duplicate or divergent result must fail closed.

## BrowserSessionCapability

`BrowserSessionCapability` is durable, opaque, unguessable and server-issued. It is never a browser-shaped OIDC result and has no public projection. Its internal fields are:

`{ capabilityId, sessionVersion, issuer, audience, subject, issuedAt, expiresAt }`

`capabilityId` is the sole browser-carried value. The other fields are resolved only by the fixed verifier. A capability is bound to one immutable verified browser session and cannot choose an issuer, audience, subject, tenant, user, agent or conversation.

## BindingScope

`BindingScope` exists only after the server combines a verified capability with exactly one canonical active TenantBundle. It is not serializable to a browser and contains:

`{ tenantKey, fabricTenantId, tenantBundleUID, issuer, audience, subject, fabricUserId, bindingState, bindingVersion }`

All fields are exact-match values. `bindingState` must be `active`; `bindingVersion` is immutable for a successful authorization decision and changes only through an explicitly reviewed server transition.

## State machine and Bootstrap-only Client0

Identity binding states are `absent`, `bootstrap-pending`, `active`, `revoked` and `expired`.

Only `bootstrap-pending -> active` may consume the one-use Client0 proof. Consumption and binding creation occur in one datastore transaction. Client0 is bootstrap-only: roster, create, read, resume and turn use the durable BrowserSessionCapability plus BindingScope and never consume Client0 again. `revoked` and `expired` never transition to `active` implicitly. A mismatch, replay, duplicate or compare-and-set loss denies without a fallback binding.

## CAS tuple and unique constraints

The datastore owns the complete CAS tuple:

`(tenantKey, fabricTenantId, tenantBundleUID, issuer, audience, subject, fabricUserId, bindingState, bindingVersion)`.

It must enforce unique constraints for `(tenantKey, issuer, audience, subject)` and for immutable `(tenantKey, fabricUserId)`. A transaction receives the full expected tuple and succeeds only when every returned field equals the expected canonical value. Divergence in tenant key, tenant ID, bundle UID, issuer, audience, subject, user ID, state or version denies. No rebinding, partial comparison, upsert overwrite or second-session fallback is permitted.

## Server route rules

A route key is a requested scope, never authority. The fixed route resolver derives the candidate tenant from the server route only after capability verification. Before catalog, CAS, Client0 or policy work it rejects a malformed route, route/session mismatch, unknown tenant or ambiguous bundle. The catalogue must return exactly one active canonical TenantBundle for the route and capability issuer/audience. No browser parameter is accepted as a tenant, principal, agent, thread, session or version authority.

## Three internal operations

1. `bootstrapBinding` consumes a fresh Client0 proof exactly once and atomically creates or reads the exact active BindingScope. It is the only operation allowed to consume Client0.
2. `resolveBinding` verifies BrowserSessionCapability, route and the complete active CAS tuple, returning an internal BindingScope. It performs no Client0 consumption.
3. `authorizeConversation` resolves the canonical AgentIdentity, compares current UID and generation to stored thread values, performs a fresh `agent.chat` decision, and then calls the thread repository with the full BindingScope and agent tuple.

Each operation returns only an internal success value or generic deny. No operation returns a remote session identifier, credential, policy tuple, identity claim, datastore key or topology.

## Conversation continuity requirements

The fixed server-owned thread repository generates unique 160-bit opaque IDs. It accepts no client thread ID during creation and exposes no remote session identifier. Read, resume and turn require the full BindingScope plus fresh canonical AgentIdentity UID and generation equality. Thread ownership, turn claim and one-use turn identity are atomic datastore operations across replicas. Collision, malformed ID, guessed ID, foreign binding, stale agent or denied policy check performs zero claim.

## Explicit exclusions

This contract does not add a provider, SQL file, schema execution, migration job, HTTP route, BFF wiring, browser API, gate enablement, secret reference, identity value, cryptographic material, credential, external secret-plane resource, vault integration, bridge integration, CI workflow or runtime resource. It must remain source-only until an independently reviewed implementation issue supplies the fixed production collaborators and migration plan.
