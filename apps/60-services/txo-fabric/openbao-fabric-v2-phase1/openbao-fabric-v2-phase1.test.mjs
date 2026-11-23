import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../../../../", import.meta.url);
const phase0Name = ["openbao-fabric-v2", "phase0"].join("-");
const tree = "apps/60-services/txo-fabric/openbao-fabric-v2-phase1";
const testPath = `${tree}/openbao-fabric-v2-phase1.test.mjs`;
const command = `node --test ${testPath}`;
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const workflowReference = new RegExp(`^\\.github/workflows/validate\\.yaml:\\d+:\\s*run:\\s*${escapeRegExp(command)}\\s*$`);
const releaseTupleReference = new RegExp(`^scripts/test-release-channel\\.py:\\d+:\\s*["']${escapeRegExp(command)}["']\\s*,?\\s*$`);
const releaseInvariant = new RegExp(`openbao_phase1_tests\\s*=\\s*[\\[(][\\s\\S]*?["']${escapeRegExp(command)}["'][\\s\\S]*?[\\])]\\s*\\n\\s*for openbao_phase1_test in openbao_phase1_tests:\\s*\\n\\s*if validate\\.count\\(openbao_phase1_test\\)\\s*!=\\s*1:`);
const read = file => readFile(new URL(`${tree}/${file}`, root), "utf8");
const readRepository = file => readFile(new URL(file, root), "utf8");

function openBaoContractJob(validate) {
  const startMarker = "  openbao-fabric-contract:\n";
  const endMarker = "  browser-authority-contract:\n";
  const start = validate.indexOf(startMarker);
  assert.notEqual(start, -1, "missing OpenBao Fabric contract job");
  const end = validate.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, "missing OpenBao contract job boundary");
  return validate.slice(start, end);
}

function externalReferences() {
  const scan = spawnSync("git", ["grep", "-n", "openbao-fabric-v2-phase1", "--", `:!${tree}/**`], { cwd: new URL(".", root).pathname, encoding: "utf8" });
  assert.ok(scan.status === 0 || scan.status === 1, scan.stderr);
  return (scan.stdout || "").trim().split("\n").filter(Boolean);
}

async function assertBoundedExternalReferences({ references = externalReferences(), validate, release } = {}) {
  const workflows = references.filter(reference => workflowReference.test(reference));
  const releaseTuples = references.filter(reference => releaseTupleReference.test(reference));
  assert.ok(workflows.length <= 1, `duplicate OpenBao workflow invocation: ${workflows.join("\n")}`);
  assert.ok(releaseTuples.length <= 1, `duplicate OpenBao release tuple: ${releaseTuples.join("\n")}`);
  for (const reference of references) assert.ok(workflowReference.test(reference) || releaseTupleReference.test(reference), reference);
  if (workflows.length === 1) {
    const openBaoJob = openBaoContractJob(validate ?? await readRepository(".github/workflows/validate.yaml"));
    assert.equal((openBaoJob.match(new RegExp(escapeRegExp(command), "g")) || []).length, 1, "OpenBao contract must invoke Phase 1 exactly once");
  }
  if (releaseTuples.length === 1) assert.match(release ?? await readRepository("scripts/test-release-channel.py"), releaseInvariant);
}

async function assertExternalReferenceFixtures() {
  const workflow = `.github/workflows/validate.yaml:145:        run: ${command}`;
  const tuple = `scripts/test-release-channel.py:177:        "${command}",`;
  assert.match(workflow, workflowReference);
  assert.match(tuple, releaseTupleReference);
  await assertBoundedExternalReferences({
    references: [workflow],
    validate: `jobs:\n  openbao-fabric-contract:\n    steps:\n      - run: ${command}\n  browser-authority-contract:\n    steps: []\n`,
  });
  await assertBoundedExternalReferences({
    references: [tuple],
    release: `openbao_phase1_tests = (\n    "${command}",\n)\nfor openbao_phase1_test in openbao_phase1_tests:\n    if validate.count(openbao_phase1_test) != 1:\n        pass\n`,
  });
  for (const reference of [
    `.github/workflows/validate.yaml:145:        run: ${command} --watch`,
    `.github/workflows/other.yaml:145:        run: ${command}`,
    `scripts/test-release-channel.py:177:        "${command}" + " --watch",`,
    `scripts/test-release-channel.py:177:        "${command}", # consumer`,
    `apps/60-services/txo-fabric/overlays/prod/kustomization.yaml:7:  - ${tree}`,
    `apps/60-services/txo-fabric/${phase0Name}/application-identity.yaml:8:  phase1Consumer: ${tree}`,
  ]) assert.ok(!workflowReference.test(reference) && !releaseTupleReference.test(reference), reference);
  assert.match(`openbao_phase1_tests = (\n    "${command}",\n)\nfor openbao_phase1_test in openbao_phase1_tests:\n    if validate.count(openbao_phase1_test) != 1:`, releaseInvariant);
  for (const invariant of [
    `openbao_phase1_tests = ("${command}",)\nif validate.count("${command}") != 1:`,
    `openbao_phase1_tests = ("${command}",)\nfor test in openbao_phase1_tests:\n    if validate.count(test) != 1:`,
  ]) assert.doesNotMatch(invariant, releaseInvariant);
}

test("Phase 1 selects only Phase 0 hardware plus v2 server shell sources", async () => {
  const [kustomization, config, certificates, patch] = await Promise.all(["kustomization.yaml", "configmap.yaml", "certificate.yaml", "statefulset-server.yaml"].map(read));
  assert.match(kustomization, new RegExp(`resources:\\n  - \\.\\.\\/${phase0Name}\\n  - configmap\\.yaml\\n  - certificate\\.yaml`));
  assert.match(kustomization, /kind: StatefulSet\n      name: openbao-fabric-v2\n    path: statefulset-server\.yaml/);
  assert.doesNotMatch(kustomization, /Application|AppProject|syncPolicy|prune|selfHeal|ExternalSecret|SecretStore|Job/);
  for (const value of ["openbao-fabric-v2-config", "openbao-fabric-v2-ca", "openbao-fabric-v2-ca-issuer", "openbao-fabric-v2-tls"]) assert.match(`${config}\n${certificates}\n${patch}`, new RegExp(value));
  assert.match(config, /api_addr = "https:\/\/openbao-fabric-v2\.txo-fabric-system\.svc:8200"/);
  assert.match(config, /storage "raft" \{\n      path = "\/openbao\/raft"\n      node_id = "openbao-fabric-v2-0"/);
  assert.match(config, /audit "file" "fabric-v2-audit"/);
  assert.match(config, /file_path = "\/openbao\/audit\/fabric-v2-audit\.log"/);
  assert.match(config, /log_raw = "false"/);
  assert.match(config, /tls_cert_file = "\/openbao\/tls\/tls\.crt"/);
  assert.match(config, /tls_key_file = "\/openbao\/tls\/tls\.key"/);
  assert.match(certificates, /kind: Issuer/);
  assert.match(certificates, /name: openbao-fabric-v2-selfsigned/);
  assert.match(certificates, /name: openbao-fabric-v2-ca/);
  assert.match(certificates, /name: openbao-fabric-v2-ca-issuer/);
  assert.match(certificates, /name: openbao-fabric-v2-tls/);
  assert.match(certificates, /secretName: openbao-fabric-v2-tls/);
  assert.match(certificates, /openbao-fabric-v2\.txo-fabric-system\.svc\.cluster\.local/);
  assert.match(patch, /name: config\n    configMap:\n      name: openbao-fabric-v2-config/);
  assert.match(patch, /mountPath: \/openbao\/config/);
  assert.match(patch, /value: \["\/usr\/bin\/bao"\]/);
  assert.match(patch, /value: \["server", "-config=\/openbao\/config\/server\.hcl"\]/);
  assert.match(patch, /tcpSocket:\n      port: 8200/);
});

test("Phase 1 stays unselected and excludes all recovery, client, and v1 surfaces", async () => {
  await assertBoundedExternalReferences();
  const source = (await Promise.all(["kustomization.yaml", "configmap.yaml", "certificate.yaml", "statefulset-server.yaml"].map(read))).join("\n");
  for (const forbidden of [/\bopenbao-fabric\b(?!-v2)/, /kind: (Application|AppProject|Job|ExternalSecret|SecretStore|ClusterSecretStore|Secret|ServiceAccount)/, /syncPolicy:|prune:|selfHeal:|ownerReferences:/, /\bauth\s+"|\btoken\b|\bkv\b|\beso\b|\bbootstrap\b|\bconsumer\b|\brecord\b|\bpolicy\b/i]) assert.doesNotMatch(source, forbidden);
});

test("Phase 1 permits only bounded future OpenBao contract and release-invariant references", async () => {
  await assertExternalReferenceFixtures();
  await assertBoundedExternalReferences();
});

test("Phase 1 local fixture isolates the exact OpenBao contract job", () => {
  const validate = `jobs:\n  openbao-fabric-contract:\n    steps:\n      - run: ${command}\n  browser-authority-contract:\n    steps: []\n`;
  const openBaoJob = openBaoContractJob(validate);
  assert.equal((openBaoJob.match(new RegExp(escapeRegExp(command), "g")) || []).length, 1);
});

test("Phase 1 render contains only the isolated v2 server shell", () => {
  const result = spawnSync("kustomize", ["build", tree], { cwd: new URL(".", root).pathname, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  for (const kind of ["PersistentVolumeClaim", "ConfigMap", "Issuer", "Certificate", "StatefulSet", "Service", "NetworkPolicy"]) assert.match(result.stdout, new RegExp(`kind: ${kind}`));
  assert.doesNotMatch(result.stdout, /kind: (Application|AppProject|Job|ExternalSecret|SecretStore|ClusterSecretStore|Secret|ServiceAccount)/);
  assert.doesNotMatch(result.stdout, /openbao-fabric-data|openbao-fabric-audit|openbao-fabric-tls/);
});
