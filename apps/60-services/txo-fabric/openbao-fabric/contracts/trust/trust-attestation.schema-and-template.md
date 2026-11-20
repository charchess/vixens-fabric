# OpenBao Fabric trust attestation schema and template

NON-RENDERED source contract. This document is a schema/template for a future
server-side observation. It is not a manifest, record, controller input or
runtime action. No attestation record is created by this document.

## Authority split

`endpointAuthority` is exactly
`openbao-fabric.txo-fabric-system.svc.cluster.local:8200`.
`sniAuthority` is exactly
`openbao-fabric.txo-fabric-system.svc.cluster.local`; every SNI field is this
one portless name, with cardinality one. It is deliberately distinct from the
endpoint authority.

## Immutable generation lifecycle

The immutable generation lifecycle is append-only; append-only refusal rejects replacement or editing. A writer assigns one opaque
immutable exact ID per generation; an existing ID collision refusal applies.
`predecessorGeneration: none | <immutable exact ID>` permits either the first
generation or precisely one prior generation. Allowed directory and filename
are `trust/attestations/<immutable exact ID>.json` only; any other directory or
filename is refused. Replacing or editing an existing generation is refused.

A future record begins `observationStatus: observed-not-trusted`. No trusted
transition is specified here. `observedAt` is writer-observed metadata only;
this template supplies no timestamp, ID, digest, observation or record.

## Structural source bindings

These desired-source facts are references and names only:

```text
certificateRef:
  apiVersion: cert-manager.io/v1
  name: openbao-fabric-tls
  namespace: txo-fabric-system
secretRef:
  name: openbao-fabric-tls
  namespace: txo-fabric-system
  key: tls.crt
serviceRef:
  apiVersion: v1
  name: openbao-fabric
  namespace: txo-fabric-system
sanSource:
  requiredName: openbao-fabric.txo-fabric-system.svc.cluster.local
```

## Future record schema placeholders

```text
TrustAttestation:
  generation: <writer-assigned-immutable-exact-ID>
  predecessorGeneration: none | <immutable exact ID>
  observedAt: <writer-observed-time>
  observationStatus: observed-not-trusted
  endpointAuthority: openbao-fabric.txo-fabric-system.svc.cluster.local:8200
  sniAuthority: openbao-fabric.txo-fabric-system.svc.cluster.local
  certificateVersionMetadata: <nonsecret-version-metadata>
  caCertDerSha256: <64 lowercase hex>
  caSpkiSha256: <64 lowercase hex>
  chainRule: exact expected chain order/cardinality; hashed DER/SPKI; refusal missing/extra/ambiguous/misordered CA
  sources:
    certificateRef: <structural-reference-above>
    secretRef: <structural-reference-above>
    serviceRef: <structural-reference-above>
    sanSource: <structural-reference-above>
```

`chainRule` requires the expected chain order/cardinality and hashes only future
DER/SPKI observations; missing, extra, ambiguous or misordered CA is refused.
Certificate version metadata is nonsecret.

## Deterministic chain and lineage validation

generationId grammar: ^[a-z0-9][a-z0-9-]{7,63}$
recordPath: apps/60-services/txo-fabric/openbao-fabric/contracts/trust/attestations/<generationId>.json

chainRule: [leaf, intermediate*, root]
- exactly one leaf at position 0
- exactly one root at final position
- CA/root absent => refuse
- any extra, ambiguous or misordered element => refuse

A predecessor must exist, be prior, observed-not-trusted, distinct.
predecessor forward/self/cycle => refuse
branching policy: one successor per predecessor; second successor => refuse

The writer validates this schema before append-only creation. These are grammar
and refusal rules only; no record, generation ID, digest or runtime action is
created by this source contract. Placeholders are schema notation, not
committed values. No encoded material, private key, payload, alternate endpoint,
deployment surface or activation exists here.
