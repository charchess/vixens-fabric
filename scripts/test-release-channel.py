#!/usr/bin/env python3
"""Fail closed when release-channel workflow invariants drift."""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"


def require(text: str, needle: str, source: Path) -> None:
    if needle not in text:
        raise AssertionError(f"{source.relative_to(ROOT)} must contain: {needle}")


def require_in_order(text: str, needles: tuple[str, ...], source: Path) -> None:
    cursor = 0
    for needle in needles:
        position = text.find(needle, cursor)
        if position < 0:
            raise AssertionError(
                f"{source.relative_to(ROOT)} must contain ordered contract steps: {needles}"
            )
        cursor = position + len(needle)


def main() -> int:
    dev_path = WORKFLOWS / "release-dev.yaml"
    prod_path = WORKFLOWS / "promote-prod.yaml"
    validate_path = WORKFLOWS / "validate.yaml"
    dev = dev_path.read_text()
    prod = prod_path.read_text()
    validate = validate_path.read_text()

    for needle in (
        "workflow_run:",
        "workflows: [Repository validation]",
        "branches: [main]",
        "types: [completed]",
        "github.event.workflow_run.conclusion == 'success'",
        "github.event.workflow_run.event == 'push'",
        "github.event.workflow_run.head_sha",
        "dev-v$(date -u +%Y.%m).${short_sha}",
        "git push origin \"refs/tags/${immutable_tag}\"",
        "git push --force origin refs/tags/dev-latest",
        "git rev-parse dev-latest^{}",
        "git ls-remote origin 'refs/tags/dev-latest^{}'",
    ):
        require(dev, needle, dev_path)
    if "workflow_dispatch:" in dev:
        raise AssertionError("release-dev.yaml must not be manually dispatchable")
    if "secrets." in dev:
        raise AssertionError("release-dev.yaml must not use repository secrets")

    for needle in (
        "workflow_dispatch:",
        "dev_candidate:",
        "required: true",
        "CANDIDATE: ${{ inputs.dev_candidate }}",
        "^dev-v[0-9]{4}",
        "actions/workflows/validate.yaml/runs?head_sha=${sha}",
        "run.get(\"head_sha\") == sha and run.get(\"conclusion\") == \"success\"",
        "git merge-base --is-ancestor \"$sha\" origin/main",
        "prod_tag=\"prod-v${CANDIDATE#dev-v}\"",
        "immutable production tag ${prod_tag} already exists",
        "git push origin \"refs/tags/${PROD_TAG}\"",
        "git push --force origin refs/tags/prod-stable",
        "git rev-parse prod-stable^{}",
        "refs/tags/prod-stable^{}",
    ):
        require(prod, needle, prod_path)
    if "secrets." in prod:
        raise AssertionError("promote-prod.yaml must not use repository secrets")
    if not re.search(r"permissions:\n(?:.*\n)*?  contents: write", dev):
        raise AssertionError("release-dev.yaml must grant only repository tag authority")
    if not re.search(r"permissions:\n(?:.*\n)*?  actions: read\n  contents: write", prod):
        raise AssertionError("promote-prod.yaml must read validation and write repository tags")

    for needle in (
        "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2",
        "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0",
        'ACTIONLINT_VERSION=1.7.7',
        'ACTIONLINT_ARCHIVE="actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"',
        'ACTIONLINT_SHA256=023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757',
        'printf \'%s  %s\\n\' "${ACTIONLINT_SHA256}" "${ACTIONLINT_ARCHIVE}" | sha256sum -c -',
        'tar -xzf "${ACTIONLINT_ARCHIVE}" actionlint',
        './actionlint .github/workflows/*.yaml',
        "fetch-depth: 0",
        "KUSTOMIZE_VERSION=5.4.3",
        "KUSTOMIZE_SHA256=3669470b454d865c8184d6bce78df05e977c9aea31c30df3c669317d43bcc7a7",
        "KUBECTL_VERSION=1.30.4",
        "KUBECTL_SHA256=2ffd023712bbc1a9390dbd8c0c15201c165a69d394787ef03eda3eccb4b9ac06",
        "sha256sum -c -",
        "kustomize build apps/60-services/txo-fabric/openbao-fabric/overlays/prod > openbao-fabric-rendered.yaml",
        "node --test apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/audit-storage.test.mjs",
        "openbao-fabric-contract:",
        "OpenBao Fabric contract",
        "needs: [repository-hygiene, release-channel-invariants, openbao-fabric-contract]",
        "OPENBAO_FABRIC_CONTRACT: ${{ needs.openbao-fabric-contract.result }}",
        "test \"$OPENBAO_FABRIC_CONTRACT\" = success",
        "FAIL-CLOSED TRANSITION:",
    ):
        require(validate, needle, validate_path)
    if "actions/checkout@v4" in validate or "actions/setup-node@v4" in validate:
        raise AssertionError("validate.yaml must use full immutable action SHAs, not moving v4 tags")
    require_in_order(
        validate,
        (
            "KUSTOMIZE_SHA256=3669470b454d865c8184d6bce78df05e977c9aea31c30df3c669317d43bcc7a7",
            "sha256sum -c -",
            "tar -xzf \"${KUSTOMIZE_ARCHIVE}\" kustomize",
            "KUBECTL_SHA256=2ffd023712bbc1a9390dbd8c0c15201c165a69d394787ef03eda3eccb4b9ac06",
            "sha256sum -c -",
            "kustomize build apps/60-services/txo-fabric/openbao-fabric/overlays/prod > openbao-fabric-rendered.yaml",
            "node --test apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/audit-storage.test.mjs",
        ),
        validate_path,
    )
    require_in_order(
        validate,
        (
            "ACTIONLINT_SHA256=023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757",
            'printf \'%s  %s\\n\' "${ACTIONLINT_SHA256}" "${ACTIONLINT_ARCHIVE}" | sha256sum -c -',
            'tar -xzf "${ACTIONLINT_ARCHIVE}" actionlint',
            "./actionlint .github/workflows/*.yaml",
        ),
        validate_path,
    )
    bootstrap = ROOT / "tests" / "test_openbao_bootstrap_reachability_contract.mjs"
    if bootstrap.exists():
        raise AssertionError(
            "bootstrap contract now exists: replace optional branch with mandatory node --test invocation in the same merge"
        )
    require(validate, "if test -f tests/test_openbao_bootstrap_reachability_contract.mjs; then", validate_path)

    print("release-channel workflow invariants: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"release-channel workflow invariants: FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
