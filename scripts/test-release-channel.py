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
        "browser-authority-contract:",
        "Browser authority contract",
        "openfga-runtime-hook-contract:",
        "OpenFGA runtime hook contract",
        "client0-bootstrap-contract:",
        "Client0 bootstrap contract",
        "go test ./internal/controller -run '^TestEvaluateClient0BootstrapEligibility$'",
        "node --test apps/60-services/txo-fabric/webui/server/authority/client0-bootstrap-ledger.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/client0-ledger-negative.test.mjs",
        "go test ./internal/controller -run '^TestClient0EligibilityFromCanonicalReadSetRejectsAuthorityGaps$'",
        "node --test apps/60-services/txo-fabric/operator/internal/controller/client0_eligibility_adapter_boundary.test.mjs",
        "node --test apps/60-services/txo-fabric/openfga/runtime/openfga-runtime-hook.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-contract.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-migration-boundary.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/authority-collaborators.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/authority-collaborators-negative.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/authority-ledger-capability-negative.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/authority-source-adapters.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/authority-source-adapters-negative.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-store.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-store-negative.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-store-numeric-negative.test.mjs",
        "needs: [repository-hygiene, release-channel-invariants, openbao-fabric-contract, browser-authority-contract, openfga-runtime-hook-contract, client0-bootstrap-contract, fabrik-public-bff-route-contract]",
        "OPENBAO_FABRIC_CONTRACT: ${{ needs.openbao-fabric-contract.result }}",
        "BROWSER_AUTHORITY_CONTRACT: ${{ needs.browser-authority-contract.result }}",
        "OPENFGA_RUNTIME_HOOK_CONTRACT: ${{ needs.openfga-runtime-hook-contract.result }}",
        "CLIENT0_BOOTSTRAP_CONTRACT: ${{ needs.client0-bootstrap-contract.result }}",
        "test \"$OPENBAO_FABRIC_CONTRACT\" = success",
        "test \"$BROWSER_AUTHORITY_CONTRACT\" = success",
        "test \"$OPENFGA_RUNTIME_HOOK_CONTRACT\" = success",
        "test \"$CLIENT0_BOOTSTRAP_CONTRACT\" = success",
        "node --test tests/test_openbao_bootstrap_reachability_contract.mjs",
    ):
        require(validate, needle, validate_path)
    if "actions/checkout@v4" in validate or "actions/setup-node@v4" in validate:
        raise AssertionError("validate.yaml must use full immutable action SHAs, not moving v4 tags")

    application_revisions = {
        ROOT / "argocd/overlays/dev/apps/hermes-umi.yaml": "main",
        ROOT / "argocd/overlays/dev/apps/txo-fabric.yaml": "main",
        ROOT / "argocd/overlays/prod/apps/txo-fabric.yaml": "prod-stable",
    }
    application_paths = sorted((ROOT / "argocd").glob("overlays/*/apps/*.yaml"))
    if set(application_paths) != set(application_revisions):
        raise AssertionError("Fabric Application inventory must be explicit and complete")
    for application_path in application_paths:
        application = application_path.read_text()
        expected_revision = application_revisions[application_path]
        require(application, "repoURL: https://github.com/charchess/vixens-fabric.git", application_path)
        require(application, f"targetRevision: {expected_revision}", application_path)
        if re.search(r"targetRevision:\\s*[0-9a-f]{40}(?:\\s|$)", application):
            raise AssertionError(f"{application_path.relative_to(ROOT)} must not pin a Git SHA")
    legacy_warning = ROOT / "scripts/warn-legacy-identifiers.py"
    if legacy_warning.exists() or "warn-legacy-identifiers.py" in validate:
        raise AssertionError("legacy identifier warning path must remain removed")
    forbidden_legacy_literals = ("synelia-recovery", "-recovery")
    for source in ROOT.rglob("*"):
        if source == Path(__file__) or not source.is_file() or ".git" in source.parts:
            continue
        try:
            content = source.read_text()
        except UnicodeDecodeError:
            continue
        if any(literal in content for literal in forbidden_legacy_literals):
            raise AssertionError(f"{source.relative_to(ROOT)} retains a forbidden legacy identifier")
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
    require_in_order(
        validate,
        (
            "BASE_SHA: ${{ github.event.pull_request.base.sha || github.event.before }}",
            '[[ "$BASE_SHA" =~ ^[0-9a-f]{40}$ ]]',
            'git fetch --no-tags origin "$BASE_SHA"',
            'test "$(git rev-parse FETCH_HEAD)" = "$BASE_SHA"',
            'git cat-file -e "${BASE_SHA}^{commit}"',
            'printf \'BASE_SHA=%s\\n\' "$BASE_SHA" >> "$GITHUB_ENV"',
            "node --test apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/audit-storage.test.mjs",
            "node --test tests/test_openbao_bootstrap_reachability_contract.mjs",
        ),
        validate_path,
    )
    openbao_phase0_tests = (
        "node --test apps/60-services/txo-fabric/openbao-fabric-v2-phase0/openbao-fabric-v2-phase0.test.mjs",
    )
    for openbao_phase0_test in openbao_phase0_tests:
        if validate.count(openbao_phase0_test) != 1:
            raise AssertionError(f"validate.yaml must invoke exactly once: {openbao_phase0_test}")
    openbao_phase1_tests = (
        "node --test apps/60-services/txo-fabric/openbao-fabric-v2-phase1/openbao-fabric-v2-phase1.test.mjs",
    )
    for openbao_phase1_test in openbao_phase1_tests:
        if validate.count(openbao_phase1_test) != 1:
            raise AssertionError(f"validate.yaml must invoke exactly once: {openbao_phase1_test}")
    openbao_phase2_tests = (
        "node --test tests/test_openbao_fabric_v2_phase2_custody_bootstrap_contract.mjs",
    )
    for openbao_phase2_test in openbao_phase2_tests:
        if validate.count(openbao_phase2_test) != 1:
            raise AssertionError(f"validate.yaml must invoke exactly once: {openbao_phase2_test}")
    openbao_fabric_job = validate.split("  openbao-fabric-contract:\n", 1)[1].split("  browser-authority-contract:\n", 1)[0]
    if "openbao-fabric-contract:\n    if:" in validate or "continue-on-error:" in openbao_fabric_job:
        raise AssertionError("OpenBao Fabric contract must not have a permissive bypass")
    require_in_order(
        openbao_fabric_job,
        (
            "KUSTOMIZE_SHA256=3669470b454d865c8184d6bce78df05e977c9aea31c30df3c669317d43bcc7a7",
            "sha256sum -c -",
            "tar -xzf \"${KUSTOMIZE_ARCHIVE}\" kustomize",
            openbao_phase2_tests[0],
        ),
        validate_path,
    )
    require_in_order(
        openbao_fabric_job,
        (
            "KUSTOMIZE_SHA256=3669470b454d865c8184d6bce78df05e977c9aea31c30df3c669317d43bcc7a7",
            "sha256sum -c -",
            "tar -xzf \"${KUSTOMIZE_ARCHIVE}\" kustomize",
            openbao_phase1_tests[0],
        ),
        validate_path,
    )
    require_in_order(
        openbao_fabric_job,
        (
            "KUSTOMIZE_SHA256=3669470b454d865c8184d6bce78df05e977c9aea31c30df3c669317d43bcc7a7",
            "sha256sum -c -",
            "tar -xzf \"${KUSTOMIZE_ARCHIVE}\" kustomize",
            openbao_phase0_tests[0],
        ),
        validate_path,
    )
    if "if test -f tests/test_openbao_bootstrap_reachability_contract.mjs; then" in validate:
        raise AssertionError("validate.yaml must not retain the optional bootstrap execution path")
    if "origin/main...HEAD" in validate:
        raise AssertionError("validate.yaml must not use origin/main as bootstrap diff authority")

    authority_tests = (
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-contract.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-migration-boundary.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/authority-collaborators.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/authority-collaborators-negative.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/authority-ledger-capability-negative.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/authority-source-adapters.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/authority-source-adapters-negative.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-store.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-store-negative.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-store-numeric-negative.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/browser-authority-004-intent/browser-authority-004-intent.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/test/bff-runtime-credentials-durability.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/browser-authority-production-projection-gap.test.mjs",
    )
    for authority_test in authority_tests:
        if validate.count(authority_test) != 1:
            raise AssertionError(f"validate.yaml must invoke exactly once: {authority_test}")
    if "browser-authority-contract:\n    if:" in validate or "continue-on-error:" in validate:
        raise AssertionError("browser authority contract must not have a permissive bypass")
    browser_authority_job = validate.split("  browser-authority-contract:\n", 1)[1].split("  openfga-runtime-hook-contract:\n", 1)[0]
    require_in_order(
        browser_authority_job,
        (
            "KUSTOMIZE_VERSION=5.4.3",
            "KUSTOMIZE_SHA256=3669470b454d865c8184d6bce78df05e977c9aea31c30df3c669317d43bcc7a7",
            "sha256sum -c -",
            "tar -xzf \"${KUSTOMIZE_ARCHIVE}\" kustomize",
            "node --test apps/60-services/txo-fabric/webui/test/bff-runtime-credentials-durability.test.mjs",
        ),
        validate_path,
    )

    openfga_test = "node --test apps/60-services/txo-fabric/openfga/runtime/openfga-runtime-hook.test.mjs"
    if validate.count(openfga_test) != 1:
        raise AssertionError("validate.yaml must invoke OpenFGA runtime hook contract exactly once")
    if "openfga-runtime-hook-contract:\n    if:" in validate or "continue-on-error:" in validate:
        raise AssertionError("OpenFGA runtime hook contract must not have a permissive bypass")

    client0_tests = (
        "go test ./internal/controller -run '^TestEvaluateClient0BootstrapEligibility$'",
        "node --test apps/60-services/txo-fabric/webui/server/authority/client0-bootstrap-ledger.test.mjs",
        "node --test apps/60-services/txo-fabric/webui/server/authority/client0-ledger-negative.test.mjs",
        "go test ./internal/controller -run '^TestClient0EligibilityFromCanonicalReadSetRejectsAuthorityGaps$'",
        "node --test apps/60-services/txo-fabric/operator/internal/controller/client0_eligibility_adapter_boundary.test.mjs",
        "go test ./internal/controller -run '^(TestCanonicalBrowserTenantAuthorityIsCurrentPrivateAndNonSerialized|TestCanonicalBrowserTenantAuthorityRefusesAnyIncompleteOrNoncurrentBundle)$'",
    )
    for client0_test in client0_tests:
        if validate.count(client0_test) != 1:
            raise AssertionError(f"validate.yaml must invoke exactly once: {client0_test}")
    if "client0-bootstrap-contract:\n    if:" in validate or "continue-on-error:" in validate:
        raise AssertionError("Client0 bootstrap contract must not have a permissive bypass")

    public_route_test = "python3 -m unittest apps/60-services/txo-fabric/webui/test/test_fabrik_public_bff_route.py"
    if validate.count(public_route_test) != 1:
        raise AssertionError("validate.yaml must invoke Fabrik public BFF route contract exactly once")
    for required in (
        "fabrik-public-bff-route-contract:",
        "Fabrik public BFF route contract",
        "fabrik-public-bff-route-contract]",
        "FABRIK_PUBLIC_BFF_ROUTE_CONTRACT: ${{ needs.fabrik-public-bff-route-contract.result }}",
        "test \"$FABRIK_PUBLIC_BFF_ROUTE_CONTRACT\" = success",
    ):
        require(validate, required, validate_path)
    if "fabrik-public-bff-route-contract:\n    if:" in validate or "continue-on-error:" in validate:
        raise AssertionError("Fabrik public BFF route contract must not have a permissive bypass")

    print("release-channel workflow invariants: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"release-channel workflow invariants: FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
