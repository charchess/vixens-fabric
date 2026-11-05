# vixens-fabric

TXO Fabric product source and GitOps manifests.

## Bootstrap status

This repository is a **no-cutover bootstrap**. It is not an active Argo CD source and contains no copied production manifests, credentials or runtime state.

## Non-goals

Moving existing TXO Fabric desired state or ArgoCD sources during bootstrap; cluster bootstrap and unrelated personal workloads.

## CI scope

Fabric Go/controller/generated-asset/image and manifest checks will be ported only together with the source they validate. The initial workflow is governance-only.

## Delivery model

Changes follow Issue → branch → PR → required CI → merge. The retained `charchess/vixens` repository remains the future multi-repository GitOps orchestrator and release/BOM authority.
