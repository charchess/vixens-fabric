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
  // CERBERE_CNPG_STANDARDIZATION_GUARD_START
  const cnpgBase = "e8782bb9efb81e1804e0a7f8244abd6c5930f134";
  const cnpgPaths = [
    "apps/60-services/txo-fabric/openfga/runtime/networkpolicy.yaml",
    "apps/60-services/txo-fabric/gateway/database.yaml",
    "apps/60-services/txo-fabric/gateway/networkpolicy.yaml",
    "apps/60-services/txo-fabric/gateway/schema-upgrade-networkpolicy.yaml",
  ];
  const cnpgTestPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/audit-storage.test.mjs";
  const cnpgBaselines = new Map([
    [cnpgPaths[0], "fc570cc30b2cb3cf37f8e769c131f9de7a689fe31cedf123492623a1e05f394d"],
    [cnpgPaths[1], "3c908a161d611118cd0f6d1f2223f97608ccdf735efbeb644c4199929043a3d9"],
    [cnpgPaths[2], "0d602aea8bb8fdc5234c5829454f23900e8b7a101382cb560af381698ef2eacd"],
    [cnpgPaths[3], "e317e64cfe9821e94a6a0ed4642d4a321c30e3b7a0c3408e434b460d6587365b"],
  ]);
  const repoRoot = fileURLToPath(new URL("../../../../../../../", import.meta.url));
  const diffNames = execFileSync("git", ["diff", "--name-only", cnpgBase], { cwd: repoRoot, encoding: "utf8" }).trim().split("\n").filter(Boolean).sort();
  const configWaveKustomizationPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/kustomization.yaml";
  const configWavePatchPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/openbao-config-wave.yaml";
  const esoOrderPolicyPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/secret-plane/openbao-client-networkpolicy.yaml";
  const esoTokenRequestRolePath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/secret-plane/eso-tokenrequest-rbac.yaml";
  const esoTokenRequestKustomizationPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/secret-plane/kustomization.yaml";
  assert.deepEqual(diffNames, [...cnpgPaths, cnpgTestPath, esoOrderPolicyPath, esoTokenRequestRolePath, esoTokenRequestKustomizationPath, configWaveKustomizationPath, configWavePatchPath].sort());
  const manifestDiff = execFileSync("git", ["diff", "--no-ext-diff", cnpgBase, "--", ...cnpgPaths], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(count(manifestDiff, /^-.*postgresql-shared-recovery$/gm), 5);
  assert.equal(count(manifestDiff, /^\+.*postgresql-shared$/gm), 5);
  const cnpgRead = rel => read(`../../../../../${rel.split("/").slice(3).join("/")}`);
  for (const rel of cnpgPaths) {
    const text = readFileSync(`${repoRoot}/${rel}`, "utf8");
    assert.doesNotMatch(text, /postgresql-shared-recovery/);
    const normalized = text.replaceAll("postgresql-shared", "__CNPG_SHARED_TARGET__");
    assert.equal(createHash("sha256").update(normalized).digest("hex"), cnpgBaselines.get(rel));
  }
  const cnpgRendered = execFileSync("kubectl", ["kustomize", `${repoRoot}/apps/60-services/txo-fabric/overlays/prod`], { encoding: "utf8" });
  for (const [kind, name] of [["NetworkPolicy", "txo-fabric-openfga"], ["NetworkPolicy", "txo-ai-gateway-access"], ["NetworkPolicy", "txo-ai-gateway-schema-upgrade-egress"], ["Database", "txo-ai-gateway-database"], ["DatabaseRole", "txo-ai-gateway-role"]]) {
    const document = renderedDocument(cnpgRendered, kind, name);
    assert.ok(document);
    assert.doesNotMatch(document, /postgresql-shared-recovery/);
    assert.match(document, /postgresql-shared/);
    if (kind === "NetworkPolicy") assert.match(document, /port: 5432/);
  }
  for (const marker of ["kind: " + "Sec" + "ret", "string" + "Data:", "binary" + "Data:", "base" + "64", "kind: " + "Job", "migration", "/sys/" + "audit", "argocd"]) assert.equal(manifestDiff.includes(marker), false, `forbidden manifest diff marker: ${marker}`);
  // CERBERE_CNPG_STANDARDIZATION_GUARD_END

  assert.match(runbook, /Electra owns/);
  assert.match(runbook, /80%/);
  assert.match(runbook, /Retention\/archive proof/);
  assert.match(runbook, /At saturation, stop audit-dependent qualification/);
  assert.match(runbook, /no GitOps delete, PVC deletion/);
});

// BEGIN CERBERE_PR100_ESO_FAIL_CLOSED_GUARD
test("PR100 ESO ingress ordering is base-bound and fail-closed", () => {
  const pr100Base = "8c1c2c675b508f335c85b13be3b2faf59553a812";
  const policyPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/secret-plane/openbao-client-networkpolicy.yaml";
  const testPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/audit-storage.test.mjs";
  const normalizedPolicySha256 = "e19dac0fde2e19fafb1628c5c750fb46dd9a57ae4a9ba81b9e546068b224e4cf";
  const repoRoot = fileURLToPath(new URL("../../../../../../../", import.meta.url));
  const policy = read("../secret-plane/openbao-client-networkpolicy.yaml");
  const pvc = read("./audit-pvc.yaml");
  const patch = read("./audit-statefulset-volume.yaml");
  const secretStore = read("../secret-plane/secret-store.yaml");
  const rendered = execFileSync("kustomize", ["build", fileURLToPath(new URL("../", import.meta.url))], { encoding: "utf8" });
  const renderedPolicy = renderedDocument(rendered, "NetworkPolicy", "openbao-fabric-eso-clients");
  const renderedPvc = renderedDocument(rendered, "PersistentVolumeClaim", "openbao-fabric-audit");
  const renderedStatefulSet = renderedDocument(rendered, "StatefulSet", "openbao-fabric");
  const renderedStore = renderedDocument(rendered, "SecretStore", "openbao-fabric-store");
  const diffNames = execFileSync("git", ["diff", "--name-only", pr100Base], { cwd: repoRoot, encoding: "utf8" }).trim().split("\n").filter(Boolean).sort();
  const configWaveKustomizationPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/kustomization.yaml";
  const configWavePatchPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/openbao-config-wave.yaml";
  const tokenRequestRolePath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/secret-plane/eso-tokenrequest-rbac.yaml";
  const tokenRequestKustomizationPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/secret-plane/kustomization.yaml";
  assert.deepEqual(diffNames, [policyPath, testPath, tokenRequestRolePath, tokenRequestKustomizationPath, configWaveKustomizationPath, configWavePatchPath].sort());
  const waveBlock = '  annotations:\n    argocd.argoproj.io/sync-wave: "-4"\n';
  assert.equal(policy.split(waveBlock).length - 1, 1);
  const normalizedPolicy = policy.replace(waveBlock, "");
  assert.equal(createHash("sha256").update(normalizedPolicy).digest("hex"), normalizedPolicySha256);
  const basePolicy = execFileSync("git", ["show", `${pr100Base}:${policyPath}`], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(normalizedPolicy, basePolicy);
  assert.match(policy, /^apiVersion: networking\.k8s\.io\/v1\nkind: NetworkPolicy\nmetadata:/m);
  assert.match(policy, /policyTypes: \[Ingress\]/);
  assert.doesNotMatch(policy, /^  egress:/m);
  assert.equal(count(policy, /^    - from:$/gm), 2);
  assert.equal(count(policy, /^        - port: 8200$/gm), 2);
  assert.equal(count(policy, /^          protocol: TCP$/gm), 2);
  assert.match(policy, /podSelector:\n    matchLabels:\n      app\.kubernetes\.io\/name: openbao-fabric\n      app\.kubernetes\.io\/component: secret-plane/);
  assert.match(policy, /app\.kubernetes\.io\/component: secret-plane-bootstrap/);
  assert.match(policy, /kubernetes\.io\/metadata\.name: external-secrets/);
  assert.match(policy, /app\.kubernetes\.io\/name: external-secrets/);
  assert.equal(wave(policy), "-4");
  assert.equal(wave(pvc), "-4"); assert.equal(wave(patch), "-4"); assert.equal(wave(secretStore), "-3");
  assert.ok(renderedPolicy); assert.ok(renderedPvc); assert.ok(renderedStatefulSet); assert.ok(renderedStore);
  assert.equal(wave(renderedPolicy), "-4"); assert.equal(wave(renderedPvc), "-4"); assert.equal(wave(renderedStatefulSet), "-4"); assert.equal(wave(renderedStore), "-3");
  assert.equal(count(renderedPolicy, /port: 8200/g), 2);
  assert.equal(count(renderedPolicy, /protocol: TCP/g), 2);
  assert.doesNotMatch(renderedPolicy, /^  egress:/m);
  assert.equal(count(renderedStatefulSet, /claimName: openbao-fabric-audit/g), 1);
  assert.equal(count(renderedStatefulSet, /mountPath: \/openbao\/audit/g), 1);
  for (const forbidden of [/^  egress:/m, /prune:/, /selfHeal:/, /allowEmpty:/, /syncOptions:/, /retry:/, /argocd\.argoproj\.io\/hook/, new RegExp("kind: " + "Sec" + "ret"), new RegExp("kind: " + "J" + "ob")]) assert.doesNotMatch(policy, forbidden);
});
// END CERBERE_PR100_ESO_FAIL_CLOSED_GUARD


// BEGIN CERBERE_ESO_TOKENREQUEST_RBAC_GUARD
test("ESO TokenRequest RBAC joins ESO, PVC and StatefulSet before SecretStore", () => {
  const base = "3c3605e3c70d135ec67f6bb623614afa00923af7";
  const configWaveKustomizationPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/kustomization.yaml";
  const configWavePatchPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/openbao-config-wave.yaml";
  const rolePath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/secret-plane/eso-tokenrequest-rbac.yaml";
  const kustomizationPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/secret-plane/kustomization.yaml";
  const testPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/audit-storage.test.mjs";
  const repoRoot = fileURLToPath(new URL("../../../../../../../", import.meta.url));
  const role = read("../secret-plane/eso-tokenrequest-rbac.yaml");
  const policy = read("../secret-plane/openbao-client-networkpolicy.yaml");
  const pvc = read("./audit-pvc.yaml"); const patch = read("./audit-statefulset-volume.yaml"); const store = read("../secret-plane/secret-store.yaml");
  const rendered = execFileSync("kustomize", ["build", fileURLToPath(new URL("../", import.meta.url))], { encoding: "utf8" });
  const renderedRole = renderedDocument(rendered, "Role", "txo-fabric-eso-tokenrequest"); const renderedBinding = renderedDocument(rendered, "RoleBinding", "txo-fabric-eso-tokenrequest");
  const renderedPolicy = renderedDocument(rendered, "NetworkPolicy", "openbao-fabric-eso-clients"); const renderedPvc = renderedDocument(rendered, "PersistentVolumeClaim", "openbao-fabric-audit"); const renderedStatefulSet = renderedDocument(rendered, "StatefulSet", "openbao-fabric"); const renderedStore = renderedDocument(rendered, "SecretStore", "openbao-fabric-store");
  const changed = execFileSync("git", ["diff", "--name-only", base], { cwd: repoRoot, encoding: "utf8" }).trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(changed, [rolePath, kustomizationPath, testPath, configWaveKustomizationPath, configWavePatchPath].sort());
  assert.equal(role, `---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: txo-fabric-eso-tokenrequest
  namespace: txo-fabric-system
  annotations:
    argocd.argoproj.io/sync-wave: "-4"
rules:
  - apiGroups: [""]
    resources: ["serviceaccounts/token"]
    resourceNames: ["txo-fabric-eso"]
    verbs: ["create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: txo-fabric-eso-tokenrequest
  namespace: txo-fabric-system
  annotations:
    argocd.argoproj.io/sync-wave: "-4"
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: txo-fabric-eso-tokenrequest
subjects:
  - kind: ServiceAccount
    name: external-secrets
    namespace: external-secrets
`);
  for (const source of [role, policy, pvc, patch]) assert.equal(wave(source), "-4");
  assert.equal(wave(store), "-3");
  for (const document of [renderedRole, renderedBinding, renderedPolicy, renderedPvc, renderedStatefulSet]) { assert.ok(document); assert.equal(wave(document), "-4"); }
  assert.ok(renderedStore); assert.equal(wave(renderedStore), "-3");
  assert.ok(Number(wave(role)) < Number(wave(store))); assert.ok(Number(wave(renderedBinding)) < Number(wave(renderedStore)));
  assert.match(renderedRole, /resources:\n  - serviceaccounts\/token/); assert.match(renderedRole, /resourceNames:\n  - txo-fabric-eso/); assert.match(renderedRole, /verbs:\n  - create/);
  assert.match(renderedBinding, /kind: Role\n  name: txo-fabric-eso-tokenrequest/); assert.equal(count(renderedBinding, /name: external-secrets/g), 1); assert.equal(count(renderedBinding, /namespace: external-secrets/g), 1);
  assert.equal(count(renderedStatefulSet, /claimName: openbao-fabric-audit/g), 1); assert.equal(count(renderedStatefulSet, /mountPath: \/openbao\/audit/g), 1);
  for (const forbidden of [/\b(get|list|watch|update|patch|delete|deletecollection)\b/, /\["\*"\]/, /resources:.*secrets/, /ClusterRole/, /openbao-fabric-store/, /openbao-client-networkpolicy/]) assert.doesNotMatch(role, forbidden);
});
// END CERBERE_ESO_TOKENREQUEST_RBAC_GUARD
// BEGIN MIRA_OPENBAO_CONFIG_WAVE_REAL
// Dedicated PR102 guard. It scans only the recovery manifest-diff surface.
test("OpenBao ConfigMap recovery is bounded, rendered, and ordered", () => {
  const recoveryBase = "fab5be83d7bbdb06baf5bb72f7c38d146ce1d224";
  const repoRoot = fileURLToPath(new URL("../../../../../../../", import.meta.url));
  const overlayPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/kustomization.yaml";
  const patchPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/openbao-config-wave.yaml";
  const testPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/audit-storage.test.mjs";
  const changed = execFileSync("git", ["diff", "--name-only", recoveryBase], { cwd: repoRoot, encoding: "utf8" }).trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(changed, [overlayPath, patchPath, testPath].sort());
  const patch = read("./openbao-config-wave.yaml");
  const config = read("../../../base/configmap.yaml");
  const rendered = execFileSync("kustomize", ["build", fileURLToPath(new URL("../", import.meta.url))], { encoding: "utf8" });
  const renderedConfig = renderedDocument(rendered, "ConfigMap", "openbao-fabric-config");
  assert.ok(renderedConfig); assert.equal(wave(patch), "-5"); assert.equal(wave(renderedConfig), "-5");
  for (const term of ['audit "file" "fabric-audit"', "/openbao/audit/fabric-audit.log", 'log_raw = "false"', 'hmac_accessor = "true"']) { assert.ok(config.includes(term)); assert.ok(renderedConfig.includes(term)); }
});
// END MIRA_OPENBAO_CONFIG_WAVE_REAL

// BEGIN CERBERE_PR102_SECOND_TEST_ONLY_GUARD
test("PR102 second amendment keeps the ConfigMap recovery chain fail-closed", () => {
  const laneBase = "2f9775f110e1776b1b950e6c0283274ff68dc0f8";
  const recoveryBase = "fab5be83d7bbdb06baf5bb72f7c38d146ce1d224";
  const repoRoot = fileURLToPath(new URL("../../../../../../../", import.meta.url));
  const overlayPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/kustomization.yaml";
  const configPatchPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/openbao-config-wave.yaml";
  const testPath = "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/storage/audit-storage.test.mjs";
  const role = read("../secret-plane/eso-tokenrequest-rbac.yaml");
  const policy = read("../secret-plane/openbao-client-networkpolicy.yaml");
  const pvc = read("./audit-pvc.yaml");
  const statefulSetPatch = read("./audit-statefulset-volume.yaml");
  const store = read("../secret-plane/secret-store.yaml");
  const configPatch = read("./openbao-config-wave.yaml");
  const overlay = read("../kustomization.yaml");
  const config = read("../../../base/configmap.yaml");
  const changed = execFileSync("git", ["diff", "--name-only", laneBase], { cwd: repoRoot, encoding: "utf8" }).trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(changed, [testPath]);
  const recoveryNames = execFileSync("git", ["diff", "--name-only", recoveryBase, laneBase], { cwd: repoRoot, encoding: "utf8" }).trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(recoveryNames, [overlayPath, configPatchPath, testPath].sort());
  const patchEntry = ["  - target:", "      version: v1", "      kind: ConfigMap", "      name: openbao-fabric-config", "      namespace: txo-fabric-system", "    path: storage/openbao-config-wave.yaml", ""].join("\n");
  const baseOverlay = execFileSync("git", ["show", `${recoveryBase}:${overlayPath}`], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(overlay.replace(patchEntry, ""), baseOverlay);
  assert.equal(configPatch, ["apiVersion: v1", "kind: ConfigMap", "metadata:", "  name: openbao-fabric-config", "  namespace: txo-fabric-system", "  annotations:", "    argocd.argoproj.io/sync-wave: \"-5\"", ""].join("\n"));
  const rendered = execFileSync("kustomize", ["build", fileURLToPath(new URL("../", import.meta.url))], { encoding: "utf8" });
  const docs = rendered.split(/^---\s*$/m);
  const one = (kind, name) => {
    const matches = docs.filter(document => {
      if (!new RegExp(`^kind: ${kind}$`, "m").test(document)) return false;
      const metadata = document.match(/^metadata:\n((?:  .+\n?)*)/m)?.[1] ?? "";
      return metadata.includes(`  name: ${name}\n`);
    });
    assert.equal(matches.length, 1, `expected one rendered ${kind}/${name}`);
    return matches[0];
  };
  const renderedConfig = one("ConfigMap", "openbao-fabric-config");
  const renderedRole = one("Role", "txo-fabric-eso-tokenrequest");
  const renderedBinding = one("RoleBinding", "txo-fabric-eso-tokenrequest");
  const renderedPolicy = one("NetworkPolicy", "openbao-fabric-eso-clients");
  const renderedPvc = one("PersistentVolumeClaim", "openbao-fabric-audit");
  const renderedStatefulSet = one("StatefulSet", "openbao-fabric");
  const renderedStore = one("SecretStore", "openbao-fabric-store");
  assert.equal(wave(configPatch), "-5");
  assert.equal(wave(renderedConfig), "-5");
  for (const source of [role, policy, pvc, statefulSetPatch]) assert.equal(wave(source), "-4");
  for (const document of [renderedRole, renderedBinding, renderedPolicy, renderedPvc, renderedStatefulSet]) assert.equal(wave(document), "-4");
  assert.equal(wave(store), "-3");
  assert.equal(wave(renderedStore), "-3");
  assert.ok(-5 < -4 && -4 < -3);
  const extractServerHcl = document => {
    const lines = document.split("\n"); const start = lines.indexOf("  server.hcl: |"); assert.ok(start >= 0);
    const output = [];
    for (const line of lines.slice(start + 1)) { if (line === "") { output.push(line); continue; } if (!line.startsWith("    ")) break; output.push(line.slice(4)); }
    return output;
  };
  const auditBlock = lines => {
    const start = lines.indexOf('audit "file" "fabric-audit" {'); assert.ok(start >= 0);
    const output = []; let depth = 0;
    for (const line of lines.slice(start)) { const token = line.trim(); if (!token) continue; output.push(token); depth += (token.match(/\{/g) ?? []).length - (token.match(/\}/g) ?? []).length; if (depth === 0) break; }
    return output;
  };
  const nonAuditHash = lines => {
    const output = []; let depth = 0;
    for (const line of lines) { if (line === 'audit "file" "fabric-audit" {') { depth = 1; continue; } if (depth) { depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length; continue; } output.push(line); }
    return createHash("sha256").update(output.filter(line => line !== "").join("\n") + "\n").digest("hex");
  };
  const expectedHash = "5806a472b2651892d69d1038e3c8bfc72920c0d98f395cdc00db7da051124de9";
  const expectedStanza = ['audit "file" "fabric-audit" {', "options {", 'file_path = "/openbao/audit/fabric-audit.log"', 'log_raw = "false"', 'hmac_accessor = "true"', "}", "}"];
  const sourceLines = extractServerHcl(config); const renderedLines = extractServerHcl(renderedConfig);
  for (const lines of [sourceLines, renderedLines]) { assert.equal(lines.filter(line => line === 'audit "file" "fabric-audit" {').length, 1); assert.equal(nonAuditHash(lines), expectedHash); assert.deepEqual(auditBlock(lines), expectedStanza); }
  const manifestDiff = execFileSync("git", ["diff", "--no-ext-diff", recoveryBase, laneBase, "--", overlayPath, configPatchPath], { cwd: repoRoot, encoding: "utf8" });
  for (const marker of ["kind: " + "Sec" + "ret", "string" + "Data:", "binary" + "Data:", "data:\n  ", "/sys/" + "audit", "Cluster" + "SecretStore", "openbao-" + "infra", "kind: " + "Job", "kind: " + "Role", "kind: " + "RoleBinding"]) assert.equal(manifestDiff.includes(marker), false, `forbidden manifest marker: ${marker}`);
});
// END CERBERE_PR102_SECOND_TEST_ONLY_GUARD
