import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../../../../", import.meta.url);
const phase0Name = ["openbao-fabric-v2", "phase0"].join("-");
const tree = "apps/60-services/txo-fabric/openbao-fabric-v2-phase1";
const read = file => readFile(new URL(`${tree}/${file}`, root), "utf8");

function externalReferences() {
  const scan = spawnSync("git", ["grep", "-n", "openbao-fabric-v2-phase1", "--", `:!${tree}/**`], { cwd: new URL(".", root).pathname, encoding: "utf8" });
  assert.ok(scan.status === 0 || scan.status === 1, scan.stderr);
  return (scan.stdout || "").trim().split("\n").filter(Boolean);
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
  assert.deepEqual(externalReferences(), []);
  const source = (await Promise.all(["kustomization.yaml", "configmap.yaml", "certificate.yaml", "statefulset-server.yaml"].map(read))).join("\n");
  for (const forbidden of [/\bopenbao-fabric\b(?!-v2)/, /kind: (Application|AppProject|Job|ExternalSecret|SecretStore|ClusterSecretStore|Secret|ServiceAccount)/, /syncPolicy:|prune:|selfHeal:|ownerReferences:/, /\bauth\s+"|\btoken\b|\bkv\b|\beso\b|\bbootstrap\b|\bconsumer\b|\brecord\b|\bpolicy\b/i]) assert.doesNotMatch(source, forbidden);
});

test("Phase 1 render contains only the isolated v2 server shell", () => {
  const result = spawnSync("kustomize", ["build", tree], { cwd: new URL(".", root).pathname, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  for (const kind of ["PersistentVolumeClaim", "ConfigMap", "Issuer", "Certificate", "StatefulSet", "Service", "NetworkPolicy"]) assert.match(result.stdout, new RegExp(`kind: ${kind}`));
  assert.doesNotMatch(result.stdout, /kind: (Application|AppProject|Job|ExternalSecret|SecretStore|ClusterSecretStore|Secret|ServiceAccount)/);
  assert.doesNotMatch(result.stdout, /openbao-fabric-data|openbao-fabric-audit|openbao-fabric-tls/);
});
