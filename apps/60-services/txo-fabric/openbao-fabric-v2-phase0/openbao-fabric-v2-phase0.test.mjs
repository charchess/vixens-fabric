import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../../../../", import.meta.url);
const tree = "apps/60-services/txo-fabric/openbao-fabric-v2-phase0";
const testPath = `${tree}/openbao-fabric-v2-phase0.test.mjs`;
const command = `node --test ${testPath}`;
const read = file => readFile(new URL(file, root), "utf8");
const names = ["openbao-fabric-v2", "openbao-fabric-v2-raft", "openbao-fabric-v2-audit", "openbao-fabric-v2-tls", "txo-fabric-openbao-v2-phase0"];
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const workflowReference = new RegExp(`^\\.github/workflows/validate\\.yaml:\\d+:\\s*run:\\s*${escapeRegExp(command)}\\s*$`);
const releaseTupleReference = new RegExp(`^scripts/test-release-channel\\.py:\\d+:\\s*["']${escapeRegExp(command)}["']\\s*,?\\s*$`);
const phase1Tree = ["openbao-fabric-v2", "phase1"].join("-");
const phase1HardwareReference = new RegExp(`^apps/60-services/txo-fabric/${phase1Tree}/kustomization\\.yaml:\\d+:\\s*-\\s+\\.\\./openbao-fabric-v2-phase0\\s*$`);
const releaseInvariant = new RegExp(`openbao_phase0_tests\\s*=\\s*[\\[(][\\s\\S]*?["']${escapeRegExp(command)}["'][\\s\\S]*?[\\])]\\s*\\n\\s*for openbao_phase0_test in openbao_phase0_tests:\\s*\\n\\s*if validate\\.count\\(openbao_phase0_test\\)\\s*!=\\s*1:`);

function externalReferences() {
  const scan = spawnSync("git", ["grep", "-n", "openbao-fabric-v2-phase0", "--", `:!${tree}/**`], { cwd: new URL(".", root).pathname, encoding: "utf8" });
  assert.ok(scan.status === 0 || scan.status === 1, scan.stderr);
  return (scan.stdout || "").trim().split("\n").filter(Boolean);
}

async function assertBoundedExternalReferences() {
  const references = externalReferences();
  const workflows = references.filter(reference => workflowReference.test(reference));
  const releaseTuples = references.filter(reference => releaseTupleReference.test(reference));
  const phase1Hardware = references.filter(reference => phase1HardwareReference.test(reference));
  assert.ok(workflows.length <= 1, `duplicate workflow invocation: ${workflows.join("\n")}`);
  assert.ok(releaseTuples.length <= 1, `duplicate release tuple: ${releaseTuples.join("\n")}`);
  assert.equal(phase1Hardware.length, 1, `missing or duplicate Phase 1 hardware boundary: ${phase1Hardware.join("\n")}`);
  for (const reference of references) assert.ok(workflowReference.test(reference) || releaseTupleReference.test(reference) || phase1HardwareReference.test(reference), reference);
  if (releaseTuples.length === 1) assert.match(await read("scripts/test-release-channel.py"), releaseInvariant);
}

function assertExternalReferenceFixtures() {
  const workflow = `.github/workflows/validate.yaml:145:        run: ${command}`;
  const tuple = `scripts/test-release-channel.py:177:        "${command}",`;
  assert.match(workflow, workflowReference);
  assert.match(tuple, releaseTupleReference);
  const phase1 = `apps/60-services/txo-fabric/${phase1Tree}/kustomization.yaml:3:  - ../openbao-fabric-v2-phase0`;
  assert.match(phase1, phase1HardwareReference);
  for (const reference of [
    `.github/workflows/validate.yaml:145:        run: ${command} --watch`,
    `.github/workflows/other.yaml:145:        run: ${command}`,
    `scripts/test-release-channel.py:177:        "${command}" + " --watch",`,
    `scripts/test-release-channel.py:177:        "${command}", # consumer`,
    `apps/60-services/txo-fabric/${phase1Tree}/kustomization.yaml:3:  - ../openbao-fabric-v2-phase0/raft-pvc.yaml`,
    `apps/60-services/txo-fabric/overlays/prod/kustomization.yaml:7:  - ${tree}`,
  ]) assert.ok(!workflowReference.test(reference) && !releaseTupleReference.test(reference) && !phase1HardwareReference.test(reference), reference);
  assert.match(`openbao_phase0_tests = (\n    "${command}",\n)\nfor openbao_phase0_test in openbao_phase0_tests:\n    if validate.count(openbao_phase0_test) != 1:`, releaseInvariant);
  for (const invariant of [
    `openbao_phase0_tests = ("${command}",)\nif validate.count("${command}") != 1:`,
    `openbao_phase0_tests = ("${command}",)\nfor test in openbao_phase0_tests:\n    if validate.count(test) != 1:`,
  ]) assert.doesNotMatch(invariant, releaseInvariant);
}

test("Phase 0 v2 replacement tree renders fresh isolated storage and network identities", async () => {
  const [kustomization, app, raft, audit, statefulset, service, tls, policy] = await Promise.all(["kustomization.yaml", "application-identity.yaml", "raft-pvc.yaml", "audit-pvc.yaml", "statefulset.yaml", "service.yaml", "tls-reference.yaml", "networkpolicy.yaml"].map(file => read(`${tree}/${file}`)));
  assert.match(kustomization, /resources:\n  - raft-pvc\.yaml\n  - audit-pvc\.yaml\n  - statefulset\.yaml\n  - service\.yaml\n  - networkpolicy\.yaml/);
  assert.doesNotMatch(kustomization, /application-identity|tls-reference/);
  assert.match(app, /kind: OpenBaoFabricV2Phase0ApplicationIdentity/);
  assert.match(app, /executable: false/);
  assert.match(app, /gitOpsSelected: false/);
  assert.match(app, /applicationName: txo-fabric-openbao-v2-phase0/);
  for (const pvc of [raft, audit]) {
    assert.match(pvc, /kind: PersistentVolumeClaim/);
    assert.match(pvc, /storageClassName: storage-rwo-retain/);
    assert.match(pvc, /accessModes: \[ReadWriteOnce\]/);
    assert.match(pvc, /volumeMode: Filesystem/);
  }
  assert.match(raft, /name: openbao-fabric-v2-raft/);
  assert.match(audit, /name: openbao-fabric-v2-audit/);
  assert.match(statefulset, /kind: StatefulSet/);
  assert.match(statefulset, /name: openbao-fabric-v2/);
  assert.match(statefulset, /serviceName: openbao-fabric-v2/);
  assert.match(statefulset, /claimName: openbao-fabric-v2-raft/);
  assert.match(statefulset, /claimName: openbao-fabric-v2-audit/);
  assert.match(statefulset, /secretName: openbao-fabric-v2-tls/);
  assert.match(service, /kind: Service/);
  assert.match(service, /name: openbao-fabric-v2/);
  assert.match(service, /app\.kubernetes\.io\/name: openbao-fabric-v2/);
  assert.match(tls, /secretName: openbao-fabric-v2-tls/);
  assert.match(tls, /executable: false/);
  assert.match(policy, /kind: NetworkPolicy/);
  assert.match(policy, /name: openbao-fabric-v2-private/);
  assert.match(policy, /app\.kubernetes\.io\/name: openbao-fabric-v2/);
  assert.match(policy, /ingress: \[\]/);
  assert.match(policy, /egress: \[\]/);
  for (const value of names) assert.ok([app, raft, audit, statefulset, service, tls, policy].some(file => file.includes(value)), value);
});

test("Phase 0 permits only bounded future CI and release-invariant references", async () => {
  assertExternalReferenceFixtures();
  await assertBoundedExternalReferences();
});

test("Phase 0 is unselected and refuses v1, client, and bootstrap surfaces", async () => {
  const files = await Promise.all(["kustomization.yaml", "application-identity.yaml", "raft-pvc.yaml", "audit-pvc.yaml", "statefulset.yaml", "service.yaml", "tls-reference.yaml", "networkpolicy.yaml"].map(file => read(`${tree}/${file}`)));
  const source = files.join("\n");
  for (const forbidden of [/\bopenbao-fabric\b(?!-v2)/, /openbao-fabric-data|openbao-fabric-audit|openbao-fabric-tls/, /ownerReferences:|syncPolicy:|prune:|selfHeal:/, /kind: (Application|Job|ExternalSecret|SecretStore|ClusterSecretStore|Secret|ServiceAccount)/, /serviceAccountName:|automountServiceAccountToken: true/, /\b(auth|kv|eso|consumer|bootstrap)\b/i, /runtimeCapability: true/]) assert.doesNotMatch(source, forbidden);
});

test("Phase 0 Kustomize render is limited to fresh v2 server boundaries", () => {
  const result = spawnSync("kustomize", ["build", tree], { cwd: new URL(".", root).pathname, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /kind: PersistentVolumeClaim/);
  assert.match(result.stdout, /kind: StatefulSet/);
  assert.match(result.stdout, /kind: Service/);
  assert.match(result.stdout, /kind: NetworkPolicy/);
  assert.doesNotMatch(result.stdout, /kind: (Application|Job|ExternalSecret|SecretStore|ClusterSecretStore|Secret|ServiceAccount)/);
});
