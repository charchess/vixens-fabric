import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  const runbook = read("../../../contracts/audit-sink-retention-rotation-fail-closed.md");
  const testSource = read("./audit-storage.test.mjs");
  const rendered = execFileSync("kustomize", ["build", fileURLToPath(new URL("../", import.meta.url))], { encoding: "utf8" });
  const renderedPvc = renderedDocument(rendered, "PersistentVolumeClaim", "openbao-fabric-audit");
  const renderedStatefulSet = renderedDocument(rendered, "StatefulSet", "openbao-fabric");
  const renderedSecretStore = renderedDocument(rendered, "SecretStore", "openbao-fabric-store");
  const patchAnnotations = patch.match(/path: \/metadata\/annotations\n  value:\n((?:    .+\n?)+)/)?.[1];
  const renderedAnnotations = renderedStatefulSet?.match(/^  annotations:\n((?:    .+\n)+)/m)?.[1];
  const prDiff = [overlay, pvc, patch, testSource, runbook].join("\n");
  const yaml = [overlay, pvc, patch].join("\n");
  const forbidden = new RegExp([
    "kind:\\s*" + "Sec" + "ret",
    "\\b" + "Sec" + "ret(?:\\." + "da" + "ta|\\/|\\s*:\\s*)",
    "(?:string" + "Data|binary" + "Data|\\bda" + "ta):",
    "ba" + "se64",
    "Cluster" + "Sec" + "retStore\\/openbao",
    "openbao-" + "infra",
    "fall" + "back",
    "kind:\\s*" + "Job",
    "rb" + "ac",
    "boot" + "strap",
  ].join("|"), "i");

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
  assert.doesNotMatch(prDiff, forbidden);
  assert.doesNotMatch(yaml, /audit\s+(enable|device)|\/v1\/sys\/audit/);

  assert.match(runbook, /Electra owns/);
  assert.match(runbook, /80%/);
  assert.match(runbook, /Retention\/archive proof/);
  assert.match(runbook, /At saturation, stop audit-dependent qualification/);
  assert.match(runbook, /no GitOps delete, PVC deletion/);
});
