import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const capsulePath = "apps/60-services/txo-fabric/openbao-fabric/contracts/openbao-policy-repair-custodian.yaml";
const testPath = "tests/test_openbao_policy_repair_custodian_contract.mjs";
const read = path => readFile(new URL(path, root), "utf8");

function lines(value) {
  return value.trim().split("\n").map(line => line.trim()).filter(Boolean);
}

function assertOnlyKnownReferences() {
  const scan = spawnSync("git", ["grep", "-n", "openbao-policy-repair-custodian", "--", `:${"!"}${capsulePath}`, `:${"!"}${testPath}`], {
    cwd: new URL(".", root).pathname,
    encoding: "utf8",
  });
  assert.equal(scan.status, 1, scan.stdout || scan.stderr);
}

test("custodian capsule is a closed, non-executable baseline-add-return contract", async () => {
  const capsule = await read(capsulePath);
  const expected = [
    "apiVersion: custody.truxonline.io/v1alpha1",
    "kind: OpenBaoPolicyRepairCustodianContract",
    "metadata:",
    "name: openbao-policy-repair-custodian",
    "spec:",
    "executable: false",
    "runtimeCapability: false",
    "requiresExistingCustodyIssuer: true",
    "refuseWithoutExistingCustodyIssuer: true",
    "cannotUnblockCurrentRuntimeAlone: true",
    "policyName: txo-fabric-webui-bff-runtime-eso",
    "baseline:",
    "attestation: ABSENT_EXISTING_CUSTODY_ISSUER_REQUIRED",
    "approvedAdd:",
    "recordPath: fabric/data/vixens/prod/apps/60-services/txo-fabric/webui-bff",
    "capabilities: [read]",
    "baselineReturn:",
    "required: true",
    "attestation: ABSENT_EXISTING_CUSTODY_ISSUER_REQUIRED",
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
    "- argo",
    "- eso",
    "- runtime",
  ];
  assert.deepEqual(lines(capsule), expected);
  for (const forbidden of [/^kind: (Job|Application|AppProject|Role|RoleBinding|ClusterRole|ServiceAccount|Secret|ExternalSecret|SecretStore)$/m, /^(containers|image|command):/m, /\bcurl\b/i, /\bvault write\b/i, /\btoken create\b/i, /\bgenerate-root\b/i, /\bauth enable\b/i]) {
    assert.doesNotMatch(capsule, forbidden);
  }
});

test("custodian contract has no executable consumer or runtime selection", () => {
  assertOnlyKnownReferences();
});
