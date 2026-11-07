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
        "release-channel-invariants:",
        "Release channel invariants",
        "python3 scripts/test-release-channel.py",
        "actionlint_1.7.7_linux_amd64.tar.gz",
        "run: ./actionlint .github/workflows/*.yaml",
        "needs: [repository-hygiene, release-channel-invariants]",
        "RELEASE_CHANNEL: ${{ needs.release-channel-invariants.result }}",
        "test \"$RELEASE_CHANNEL\" = success",
    ):
        require(validate, needle, validate_path)

    print("release-channel workflow invariants: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"release-channel workflow invariants: FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
