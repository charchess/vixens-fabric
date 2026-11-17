import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("audit storage renders as a unique non-secret sink while preserving OpenBao security context", () => {
  const overlay = read("../kustomization.yaml");
  const pvc = read("./audit-pvc.yaml");
  const patch = read("./audit-statefulset-volume.yaml");
  const statefulSet = read("../../../base/statefulset.yaml");
  const runbook = read("../../../contracts/audit-sink-retention-rotation-fail-closed.md");
  const yaml = [overlay, pvc, patch].join("\n");
  const modified = [yaml, runbook].join("\n");

  assert.match(overlay, /^  - storage\/audit-pvc\.yaml$/m);
  assert.match(overlay, /path: storage\/audit-statefulset-volume\.yaml/);
  assert.match(pvc, /name: openbao-fabric-audit/);
  assert.match(pvc, /accessModes:\s+\- ReadWriteOnce/);
  assert.match(pvc, /storageClassName: storage-rwo-retain/);
  assert.match(pvc, /storage:\s+5Gi/);
  assert.match(pvc, /argocd\.argoproj\.io\/sync-options: Prune=false,Delete=false/);
  assert.match(patch, /claimName: openbao-fabric-audit/);
  assert.match(patch, /mountPath: \/openbao\/audit/);
  assert.match(statefulSet, /runAsUser: 100/);
  assert.match(statefulSet, /runAsGroup: 1000/);
  assert.match(statefulSet, /fsGroup: 1000/);
  assert.match(statefulSet, /runAsNonRoot: true/);
  assert.match(statefulSet, /readOnlyRootFilesystem: true/);

  assert.doesNotMatch(patch, /data-openbao-fabric-0-synelia|\/openbao\/data/);
  assert.doesNotMatch(yaml, /kind:\s*Secret|(?:stringData|binaryData|\bdata):|base64|ClusterSecretStore\/openbao|openbao-infra|fallback/i);
  assert.doesNotMatch(yaml, /audit\s+(enable|device)|\/v1\/sys\/audit/);
  assert.match(runbook, /Electra owns/);
  assert.match(runbook, /80%/);
  assert.match(runbook, /Retention\/archive proof/);
  assert.match(runbook, /At saturation, stop audit-dependent qualification/);
  assert.match(runbook, /no GitOps delete, PVC deletion/);
});
