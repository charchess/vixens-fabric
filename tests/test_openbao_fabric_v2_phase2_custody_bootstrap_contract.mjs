import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const contractPath = "apps/60-services/txo-fabric/openbao-fabric-v2-phase2-custody-bootstrap/contract.yaml";
const contractName = "openbao-fabric-v2-phase2-custody-bootstrap";
const read = () => readFile(new URL(contractPath, root), "utf8");

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

test("Phase 2 contract is neither rendered nor selected by Phase 1 or another tracked consumer", () => {
  const scan = spawnSync("git", ["grep", "-n", contractName, "--", `:!${contractPath}`, ":!tests/test_openbao_fabric_v2_phase2_custody_bootstrap_contract.mjs"], { cwd: new URL(".", root).pathname, encoding: "utf8" });
  assert.equal(scan.status, 1, scan.stdout || scan.stderr);
});
