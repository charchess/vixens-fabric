import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (source, expression) => (source.match(expression) ?? []).length;
const wave = source => source.match(/argocd\.argoproj\.io\/sync-wave: "(-?\d+)"/)?.[1];
const renderedDocument = (rendered, kind, name) => rendered.split(/^---\s*$/m)
  .find(document => new RegExp(`kind: ${kind}\\n[\\s\\S]*?name: ${name}\\n`).test(document));

test("audit storage aligns WFFC waves before its SecretStore", () => {
  const overlay = read("../kustomization.yaml");
  const pvc = read("./audit-pvc.yaml");
  const patch = read("./audit-statefulset-volume.yaml");
  const secretStore = read("../secret-plane/secret-store.yaml");
  const statefulSet = read("../../../base/statefulset.yaml");
  const config = read("../../../base/configmap.yaml");
  const runbook = read("../../../contracts/audit-sink-retention-rotation-fail-closed.md");
  const testSource = read("./audit-storage.test.mjs");
  const rendered = execFileSync("kustomize", ["build", fileURLToPath(new URL("../", import.meta.url))], { encoding: "utf8" });
  const renderedPvc = renderedDocument(rendered, "PersistentVolumeClaim", "openbao-fabric-audit");
  const renderedStatefulSet = renderedDocument(rendered, "StatefulSet", "openbao-fabric");
  const renderedSecretStore = renderedDocument(rendered, "SecretStore", "openbao-fabric-store");
  const patchAnnotations = patch.match(/path: \/metadata\/annotations\n  value:\n((?:    .+\n?)+)/)?.[1];
  const renderedAnnotations = renderedStatefulSet?.match(/^  annotations:\n((?:    .+\n)+)/m)?.[1];
  const prDiff = [overlay, pvc, patch, config, testSource, runbook].join("\n");
  const yaml = [overlay, pvc, patch].join("\n");
  const forbidden = [
    "kind: " + "Sec" + "ret",
    "string" + "Data:",
    "binary" + "Data:",
    "ba" + "se64",
    "Cluster" + "Secret" + "Store/openbao",
    "openbao-" + "infra",
    "/sys/" + "audit",
    "fall" + "back",
  ];

  assert.match(overlay, /^  - storage\/audit-pvc\.yaml$/m);
  assert.match(overlay, /path: storage\/audit-statefulset-volume\.yaml/);
  assert.equal(count(pvc, /^  name: openbao-fabric-audit$/gm), 1);
  assert.match(pvc, /accessModes:\s+\- ReadWriteOnce/);
  assert.match(pvc, /storageClassName: storage-rwo-retain/);
  assert.match(pvc, /storage:\s+5Gi/);
  assert.match(pvc, /argocd\.argoproj\.io\/sync-options: Prune=false,Delete=false/);
  assert.equal(wave(pvc), "-4");

  assert.doesNotMatch(statefulSet, /^  annotations:/m);
  assert.match(patch, /path: \/metadata\/annotations$/m);
  assert.ok(patchAnnotations);
  assert.equal(patchAnnotations.trim(), 'argocd.argoproj.io/sync-wave: "-4"');
  assert.equal(count(patch, /^    name: audit$/gm), 2);
  assert.equal(count(patch, /^      claimName: openbao-fabric-audit$/gm), 1);
  assert.equal(count(patch, /^    mountPath: \/openbao\/audit$/gm), 1);
  assert.match(patch, /readOnly: false/);
  assert.doesNotMatch(patch, /data-openbao-fabric-0-synelia|\/openbao\/data/);
  assert.equal(wave(secretStore), "-3");
  assert.ok(Number(wave(pvc)) < Number(wave(secretStore)));

  assert.ok(renderedPvc);
  assert.ok(renderedStatefulSet);
  assert.ok(renderedSecretStore);
  assert.equal(wave(renderedPvc), "-4");
  assert.equal(wave(renderedStatefulSet), "-4");
  assert.equal(wave(renderedSecretStore), "-3");
  assert.equal(renderedAnnotations?.trim(), 'argocd.argoproj.io/sync-wave: "-4"');
  assert.equal(count(renderedStatefulSet, /claimName: openbao-fabric-audit/g), 1);
  assert.equal(count(renderedStatefulSet, /mountPath: \/openbao\/audit/g), 1);

  assert.match(statefulSet, /runAsUser: 100/);
  assert.match(statefulSet, /runAsGroup: 1000/);
  assert.match(statefulSet, /fsGroup: 1000/);
  assert.match(statefulSet, /runAsNonRoot: true/);
  assert.match(statefulSet, /readOnlyRootFilesystem: true/);
  for (const marker of forbidden) assert.equal(prDiff.includes(marker), false, `forbidden marker: ${marker}`);
  assert.doesNotMatch(yaml, /audit\s+(enable|device)|\/v1\/sys\/audit/);
  // CERBERE_SERVER_HCL_CONTRACT_START
  const lineFeed = String.fromCharCode(10);
  const expectedNonAuditServerHclSha256 = "5806a472b2651892d69d1038e3c8bfc72920c0d98f395cdc00db7da051124de9";
  const extractServerHclLines = document => {
    const lines = document.split(lineFeed);
    const startLine = lines.indexOf("  server.hcl: |");
    assert.ok(startLine >= 0);
    const result = [];
    for (const line of lines.slice(startLine + 1)) {
      if (line === "") { result.push(line); continue; }
      if (!line.startsWith("    ")) break;
      result.push(line.slice(4));
    }
    return result;
  };
  const withoutAudit = lines => {
    const result = [];
    let depth = 0;
    for (const line of lines) {
      if (line === 'audit "file" "fabric-audit" {') { depth = 1; continue; }
      if (depth > 0) { depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length; continue; }
      result.push(line);
    }
    return result;
  };
  const serverHclSha256 = lines => createHash("sha256").update(withoutAudit(lines).filter(line => line !== "").join(lineFeed) + lineFeed).digest("hex");
  const configLines = extractServerHclLines(config);
  const renderedConfig = renderedDocument(rendered, "ConfigMap", "openbao-fabric-config");
  assert.ok(renderedConfig);
  const renderedConfigLines = extractServerHclLines(renderedConfig);
  assert.equal(configLines.filter(line => line === 'audit "file" "fabric-audit" {').length, 1);
  assert.equal(renderedConfigLines.filter(line => line === 'audit "file" "fabric-audit" {').length, 1);
  assert.equal(serverHclSha256(configLines), expectedNonAuditServerHclSha256);
  assert.equal(serverHclSha256(renderedConfigLines), expectedNonAuditServerHclSha256);
  const auditTokenLines = lines => {
    const start = lines.indexOf('audit "file" "fabric-audit" {');
    assert.ok(start >= 0);
    const tokens = [];
    let depth = 0;
    for (const line of lines.slice(start)) {
      const token = line.trim();
      if (token === "") continue;
      tokens.push(token);
      depth += (token.match(/\{/g) ?? []).length - (token.match(/\}/g) ?? []).length;
      if (depth === 0) break;
    }
    return tokens;
  };
  const expectedAuditTokens = [
    'audit "file" "fabric-audit" {',
    'options {',
    'file_path = "/openbao/audit/fabric-audit.log"',
    'log_raw = "false"',
    'hmac_accessor = "true"',
    '}',
    '}',
  ];
  assert.deepEqual(auditTokenLines(configLines), expectedAuditTokens);
  assert.deepEqual(auditTokenLines(renderedConfigLines), expectedAuditTokens);
  // CERBERE_SERVER_HCL_CONTRACT_END

  assert.match(runbook, /Electra owns/);
  assert.match(runbook, /80%/);
  assert.match(runbook, /Retention\/archive proof/);
  assert.match(runbook, /At saturation, stop audit-dependent qualification/);
  assert.match(runbook, /no GitOps delete, PVC deletion/);
});
