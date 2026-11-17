import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("audit storage is retained, distinct from Raft, and mounted without a secret sink", () => {
  const overlay = read("../kustomization.yaml");
  const pvc = read("./audit-pvc.yaml");
  const patch = read("./audit-statefulset-volume.yaml");
  const source = [overlay, pvc, patch].join("\n");

  assert.match(overlay, /^  - storage\/audit-pvc\.yaml$/m);
  assert.match(overlay, /path: storage\/audit-statefulset-volume\.yaml/);
  assert.match(pvc, /name: openbao-fabric-audit/);
  assert.match(pvc, /accessModes:\s+\- ReadWriteOnce/);
  assert.match(pvc, /storageClassName: storage-rwo-retain/);
  assert.match(pvc, /storage:\s+5Gi/);
  assert.match(pvc, /argocd\.argoproj\.io\/sync-options: Prune=false,Delete=false/);
  assert.match(patch, /claimName: openbao-fabric-audit/);
  assert.match(patch, /mountPath: \/openbao\/audit/);
  assert.match(patch, /readOnly: false/);

  assert.doesNotMatch(patch, /data-openbao-fabric-0-synelia|\/openbao\/data/);
  assert.doesNotMatch(source, /kind:\s*Secret|stringData:|\.data:|ClusterSecretStore\/openbao/);
  assert.doesNotMatch(source, /audit\s+(enable|device)|\/v1\/sys\/audit/);
});
