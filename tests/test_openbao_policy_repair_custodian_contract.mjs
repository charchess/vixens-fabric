import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const capsulePath = "apps/60-services/txo-fabric/openbao-fabric/contracts/openbao-policy-repair-custodian.yaml";
const testPath = "tests/test_openbao_policy_repair_custodian_contract.mjs";
const policyName = "txo-fabric-webui-bff-runtime-eso";
const recordPath = "fabric/data/vixens/prod/apps/60-services/txo-fabric/webui-bff";
const absent = "ABSENT_EXISTING_AUTHENTICATED_AUTHORITY_REQUIRED";
const read = path => readFile(new URL(path, root), "utf8");
const lines = value => value.trim().split("\n").map(line => line.trim()).filter(Boolean);
const phaseHash = phase => `sha256:${createHash("sha256").update(`phase=${phase}\npolicy=${policyName}\nrecordPath=${recordPath}\ncapability=read\nbaseline=${absent}\n`).digest("hex")}`;

function assertOnlyKnownReferences() {
  const scan = spawnSync("git", ["grep", "-n", "openbao-policy-repair-custodian", "--", `:${"!"}${capsulePath}`, `:${"!"}${testPath}`], {
    cwd: new URL(".", root).pathname,
    encoding: "utf8",
  });
  assert.equal(scan.status, 1, scan.stdout || scan.stderr);
}

test("two-tier custodian contract is closed, immutable, and non-executable", async () => {
  const capsule = await read(capsulePath);
  const expected = [
    "apiVersion: custody.truxonline.io/v1alpha1",
    "kind: OpenBaoPolicyRepairCustodianContract",
    "metadata:",
    "name: openbao-policy-repair-custodian",
    "spec:",
    "executable: false",
    "runtimeCapability: false",
    "gitOpsConsumer: false",
    "requiresExistingAuthenticatedAuthority: true",
    "cannotBootstrapInitialCustodyAlone: true",
    "cannotUnblockCurrentRuntimeAlone: true",
    "fabricImmutablePolicyEnvelope:",
    `policyName: ${policyName}`,
    "mountPath: fabric",
    `recordPath: ${recordPath}`,
    "baseline:",
    `attestation: ${absent}`,
    "approvedAdd:",
    "capabilities: [read]",
    `phaseHash: ${phaseHash("add")}`,
    "requiredRevoke:",
    `phaseHash: ${phaseHash("revoke")}`,
    `baselineReturnAttestation: ${absent}`,
    "vixensInfraCustodyIssuanceContract:",
    "repository: charchess/vixens-infra",
    "ref: main",
    `authorityRef: ${absent}`,
    "issuerContractRef: ABSENT_SEPARATE_VIXENS_INFRA_CONTRACT_REQUIRED",
    "electraRecoveryConstraints:",
    "identityRef: EXISTING_AUTHENTICATED_ELECTRA_RECOVERY_IDENTITY_REQUIRED",
    "delegation:",
    "ttlSeconds: 900",
    "renewable: false",
    "storage: memory-only",
    "wrapped: true",
    "helperRefusalModel:",
    "fixed: true",
    "refuseMissingAuthority: true",
    "refusePolicyMismatch: true",
    "refuseRecordMismatch: true",
    "refusePhaseHashMismatch: true",
    "refuseTTLAbove900Seconds: true",
    "refuseRenewableOrPersistentOrUnwrappedDelegation: true",
    "receiptSchema:",
    "version: v1",
    "allowedFields: [phase, phaseHash, policyName, recordPath, capabilityCategories, custodyAttribution, auditOutcome, revoked]",
    "forbiddenFields: [credential, token, wrappedPayload, policyBody, providerPayload, root, share]",
    "refusedCapabilities:",
    "- metadata",
    "- list",
    "- sibling-read",
    "- write",
    "- delete",
    "- token",
    "- root",
    "- share",
    "- listener",
    "- auth-method",
    "- job",
    "- ci",
    "- argo",
    "- eso",
    "- runtime",
  ];
  assert.deepEqual(lines(capsule), expected);
  for (const forbidden of [/^kind: (Job|Application|AppProject|Role|RoleBinding|ClusterRole|ServiceAccount|Secret|ExternalSecret|SecretStore)$/m, /^(containers|image|command):/m, /\bcurl\b/i, /\bvault write\b/i, /\btoken create\b/i, /\bgenerate-root\b/i, /\bauth enable\b/i]) {
    assert.doesNotMatch(capsule, forbidden);
  }
});

test("custodian contract has no executable consumer, GitOps selection, or runtime object", () => {
  assertOnlyKnownReferences();
});
