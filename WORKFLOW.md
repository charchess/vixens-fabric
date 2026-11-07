# Workflow

## Canonical path

```text
GitHub Issue → branch → Pull Request → required CI → merge to main
```

This repository has no independent deployment or production-promotion authority. Until an approved Argo CD handoff exists, `main` is source preparation only.

## Repository-local release tags

GitHub Actions in this repository are the authority only for its Git tags:

- A successful `Repository validation` push on `main` creates one immutable `dev-vYYYY.MM.<short-sha>` tag and moves `dev-latest` to that exact commit.
- Production promotion is a human-dispatched `Promote production release` workflow. The operator must supply an exact immutable development tag. The workflow requires successful repository validation for the resolved commit and confirms that commit is an ancestor of `main` before it creates the immutable corresponding `prod-vYYYY.MM.<short-sha>` tag and locally verifies the `prod-stable` update.
- Development and production tags are repository-local release evidence; they do not grant deployment authority.

Argo CD revision changes/reconciliation and physical-platform acceptance are separate human-controlled boundaries. This repository does not change an active Argo root `targetRevision`, activate manifests, alter credentials, or modify tenant/cluster state.

## Required review questions

1. Does the change stay within this repository's responsibility?
2. Are any new platform/service requirements declared through the contract model?
3. Does it alter an active Argo CD owner, a release BOM, stateful identity, or a security boundary? If yes, stop and use the dedicated orchestration/migration issue.
4. Are all applicable CI checks green, with no unexpected skipped required job?
5. For production tags, has a human intentionally dispatched the promotion workflow with the exact approved development candidate?
