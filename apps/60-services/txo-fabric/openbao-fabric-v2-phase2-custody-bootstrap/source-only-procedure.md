# OpenBao Fabric V2 Phase 2 — source-only procedure

## Purpose and boundary

This phase records the topology and evidence boundary for a future Fabric OpenBao bootstrap ceremony. It is a source-only contract: it has no rendered Kustomization, no selected Argo source and no executable delivery surface.

GitOps may declare topology; it must not execute init, unseal, or custody.

No Kubernetes Job, CronJob, Secret, ExternalSecret, SecretStore, Application, or runtime client is introduced by this phase.

## Required evidence before an operational ceremony

The live ceremony is outside Git and CI. Its operator must first hold a working authenticated Infra custody identity and prove, without disclosing material:

- strict private TLS to the intended Fabric endpoint, with the exact endpoint, server name and approved CA/pin;
- the applicable audit device is secret-safe and records no raw request or response values;
- the retained Raft and audit storage identities, recovery material custody reference and rollback boundary;
- a bounded recipient identity and an issuance/delivery contract reviewed outside this repository.

A Git commit, a rendered manifest, a CI result, a Pod Ready condition or an Argo state does not substitute for this evidence.

## Live destructive-test gate

No live destructive test is authorized by this source-only procedure.

A later dedicated operational decision may authorize a true initialization test only after the evidence above is accepted. That decision must name the exact disposable or isolated target, data-retention disposition, expected initialization observation, recovery owner and rollback point. Until then, do not delete or recreate the existing Fabric OpenBao, its PVCs, or its audit data.

## Git-only rollback

This document is reversible by a Git revert. It changes no selected manifest, release pointer, controller behavior, custody state or runtime object.
