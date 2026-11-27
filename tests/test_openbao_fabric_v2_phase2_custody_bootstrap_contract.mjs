import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const phase2Tree = "apps/60-services/txo-fabric/openbao-fabric-v2-phase2-custody-bootstrap";
const contractPath = `${phase2Tree}/contract.yaml`;
const procedurePath = `${phase2Tree}/source-only-procedure.md`;
const contractName = "openbao-fabric-v2-phase2-custody-bootstrap";
const read = () => readFile(new URL(contractPath, root), "utf8");
const readProcedure = () => readFile(new URL(procedurePath, root), "utf8");
const expectedSpecKeys = ["executable", "runtimeCapability", "gitOpsConsumer", "phase1Selected", "requiresExistingAuthenticatedAuthority", "cannotBootstrapInitialCustodyAlone", "cannotUnblockCurrentRuntimeAlone", "policyEnvelopeIdentity", "custodyIssuanceReference", "receiptSchema", "refusedCapabilities"];
const expectedReceiptAllowed = ["phase", "phaseHash", "policyName", "recordPath", "capabilityCategories", "custodyAttribution", "auditOutcome", "revoked"];
const expectedReceiptForbidden = ["credential", "token", "wrappedPayload", "policyBody", "providerPayload", "root", "share"];
const expectedRefused = ["auth", "kv", "eso", "listener", "network", "record", "bff", "bridge", "client", "bootstrap", "secret", "serviceaccount", "job", "cronjob", "application", "runtime"];
const list = (source, key) => (source.match(new RegExp(`^\\s*${key}: \\[([^\\]]*)\\]$`, "m"))?.[1] || "").split(",").map(value => value.trim()).filter(Boolean);

function validateClosedSpec(source) {
  const spec = source.split("spec:\n", 2)[1] || "";
  assert.deepEqual([...spec.matchAll(/^  ([A-Za-z][A-Za-z0-9]*):/gm)].map(match => match[1]), expectedSpecKeys);
  for (const key of ["executable", "runtimeCapability", "gitOpsConsumer", "phase1Selected"]) assert.match(source, new RegExp(`^  ${key}: false$`, "m"));
  for (const key of ["requiresExistingAuthenticatedAuthority", "cannotBootstrapInitialCustodyAlone", "cannotUnblockCurrentRuntimeAlone"]) assert.match(source, new RegExp(`^  ${key}: true$`, "m"));
  assert.deepEqual(list(source, "approvedTransientCapabilities"), ["read"]);
  assert.deepEqual(list(source, "allowedFields"), expectedReceiptAllowed);
  assert.deepEqual(list(source, "forbiddenFields"), expectedReceiptForbidden);
  assert.deepEqual(list(source, "refusedCapabilities"), expectedRefused);
}

test("Phase 2 custody-bootstrap contract is a closed non-executable policy-envelope record", async () => {
  const source = await read();
  for (const expected of [
    "kind: OpenBaoFabricV2Phase2CustodyBootstrapContract",
    `name: ${contractName}`,
    "executable: false",
    "runtimeCapability: false",
    "gitOpsConsumer: false",
    "phase1Selected: false",
    "requiresExistingAuthenticatedAuthority: true",
    "cannotBootstrapInitialCustodyAlone: true",
    "cannotUnblockCurrentRuntimeAlone: true",
    "policyName: txo-fabric-webui-bff-runtime-eso",
    "mountPath: fabric",
    "recordPath: fabric/data/vixens/prod/apps/60-services/txo-fabric/webui-bff",
    "approvedTransientCapabilities: [read]",
    "repository: charchess/vixens-infra",
    "issuerContractRef: ABSENT_SEPARATE_VIXENS_INFRA_CONTRACT_REQUIRED",
    "allowedFields: [phase, phaseHash, policyName, recordPath, capabilityCategories, custodyAttribution, auditOutcome, revoked]",
    "forbiddenFields: [credential, token, wrappedPayload, policyBody, providerPayload, root, share]",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const forbidden of [/^kind: (Secret|ServiceAccount|Job|CronJob|Application|AppProject|ExternalSecret|SecretStore|ClusterSecretStore)$/m, /^(containers|image|command):/m, /syncPolicy:|automated:|prune:|selfHeal:|retry:|finalizers:/, /^(data|stringData|binaryData):/m]) assert.doesNotMatch(source, forbidden);
});

test("Phase 2 exact closed spec rejects capability mutation fixtures", async () => {
  const source = await read();
  assert.doesNotThrow(() => validateClosedSpec(source));
  for (const capability of ["auth", "kv", "eso", "client", "bootstrap", "application", "runtime"]) {
    assert.throws(() => validateClosedSpec(source.replace(new RegExp(`(?:${capability},\\s*|,\\s*${capability}(?=\\]|,))`), "")), capability);
  }
  assert.throws(() => validateClosedSpec(source.replace("auth", "authorization")), "substitute auth");
});

test("Phase 2 source-only procedure forbids GitOps custody and gates any destructive test", async () => {
  const procedure = await readProcedure();
  for (const expected of [
    "# OpenBao Fabric V2 Phase 2 — source-only procedure",
    "GitOps may declare topology; it must not execute init, unseal, or custody.",
    "working authenticated Infra custody identity",
    "No Kubernetes Job, CronJob, Secret, ExternalSecret, SecretStore, Application, or runtime client is introduced by this phase.",
    "do not delete or recreate the existing Fabric OpenBao, its PVCs, or its audit data",
    "No live destructive test is authorized by this source-only procedure.",
  ]) assert.ok(procedure.includes(expected), expected);
  for (const forbidden of [/kubectl\s+(delete|apply|patch|replace|rollout|exec)/i, /bao\s+operator\s+(init|unseal)/i, /auth\/token\/create/i, /sys\/policies/i]) assert.doesNotMatch(procedure, forbidden);
});

test("Phase 2 contract is neither rendered nor selected by Phase 1 or another tracked consumer", () => {
  const scan = spawnSync("git", ["grep", "-n", contractName, "--", `:!${contractPath}`, ":!tests/test_openbao_fabric_v2_phase2_custody_bootstrap_contract.mjs"], { cwd: new URL(".", root).pathname, encoding: "utf8" });
  assert.equal(scan.status, 1, scan.stdout || scan.stderr);
});
