# OpenBao Fabric trust attestation schema and template

NON-RENDERED source contract. This document is a schema/template for a future
server-side observation. It is not a manifest, record, controller input or
runtime action. No attestation record is created by this document.

## Authority split

`endpointAuthority` is exactly
`openbao-fabric.txo-fabric-system.svc.cluster.local:8200`. It identifies the
network authority for a future observer and is not a value to place in an
application configuration.

`sniAuthority` is exactly
`openbao-fabric.txo-fabric-system.svc.cluster.local`. It is a portless TLS name
and is deliberately distinct from `endpointAuthority`.

The only initial status is `observed-not-trusted`. That status means a future
observer may report structural source agreement but cannot establish trust from
this document alone.

## Immutable generation lifecycle

The immutable generation lifecycle is defined as follows.

A future attestation has an opaque `generation` selected by its authoritative
writer exactly once. Generation is immutable: a later observation creates a
new generation rather than modifying an earlier one. This template contains no
generation value, digest, timestamp, chain material or observation result.

Permitted lifecycle transitions are:

`unrecorded -> observed-not-trusted`

No transition to a trusted state is specified here. Expiry, replacement and
revocation are future separately reviewed contracts.

## Structural source bindings

A future observer binds these desired-source facts by object reference and key
name only:

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
  certificate: openbao-fabric-tls
  requiredName: openbao-fabric.txo-fabric-system.svc.cluster.local
```

`certificateRef`, `secretRef`, `serviceRef` and `sanSource` are structural
references. They do not embed, request, read or project certificate material.
The CA and leaf Certificate relationship remains a desired-source fact; no
chain, key, encoded payload, Secret payload or endpoint observation belongs in
this contract.

## Future record shape

```text
TrustAttestation:
  generation: <writer-assigned-opaque-generation>
  status: observed-not-trusted
  endpointAuthority: openbao-fabric.txo-fabric-system.svc.cluster.local:8200
  sniAuthority: openbao-fabric.txo-fabric-system.svc.cluster.local
  sources:
    certificateRef: <structural-reference-above>
    secretRef: <structural-reference-above>
    serviceRef: <structural-reference-above>
    sanSource: <structural-reference-above>
```

The placeholders are schema notation, not values to commit. This contract has
no alternate endpoint, no transport selection and no deployment surface.
