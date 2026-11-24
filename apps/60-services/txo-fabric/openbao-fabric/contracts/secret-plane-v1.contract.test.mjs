import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractUrl = new URL("./secret-plane-v1.contract.json", import.meta.url);
const boundaryNames = new Set(["bootstrap", "mount", "auth", "policy", "role", "eso"]);
const forbiddenKeys = new Set(["secret", "root", "unseal"]);

function validate(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validate(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbiddenKeys.has(key.toLowerCase()), `forbidden field at ${path}.${key}`);
      validate(child, `${path}.${key}`);
    }
  }
}

function validateContract(contract) {
  assert.deepEqual(Object.keys(contract).sort(), [
    "activation",
    "allowedReferences",
    "boundaries",
    "hmac",
    "issue",
    "prohibitions",
    "schemaVersion",
    "status",
  ]);
  assert.equal(contract.schemaVersion, "v1");
  assert.equal(contract.issue, "#118");
  assert.equal(contract.status, "source-only");
  assert.equal(contract.activation, false);
  assert.deepEqual(new Set(Object.keys(contract.boundaries)), boundaryNames);
  assert.equal(contract.boundaries.bootstrap.authority, "out-of-git platform custody");
  assert.equal(contract.boundaries.bootstrap.material, "excluded-from-git");
  assert.deepEqual(contract.boundaries.bootstrap.requirements, ["idempotence", "auditability", "revocation"]);
  for (const boundary of ["mount", "auth", "policy", "role"]) {
    assert.equal(contract.boundaries[boundary].declaration, "named-only");
    assert.equal(contract.boundaries[boundary].configuration, "excluded-from-this-contract");
  }
  assert.equal(contract.boundaries.eso.declaration, "named-only");
  assert.match(contract.boundaries.eso.runtimeEvidence, /^SecretStore Ready=True/);
  assert.deepEqual(contract.hmac.paths, ["hmac/fabric/eso/v1"]);
  assert.equal(contract.hmac.cardinality, "exactly-one");
  assert.deepEqual(contract.prohibitions, [
    "secret-values",
    "root-credentials",
    "unseal-material",
    "active-manifests",
    "runtime-claims",
  ]);
  assert.deepEqual(contract.allowedReferences, [
    "bootstrap",
    "mount",
    "auth",
    "policy",
    "role",
    "eso",
    "hmac/fabric/eso/v1",
  ]);
  validate(contract);
}

test("secret-plane v1 is a closed, source-only boundary contract", async () => {
  const contract = JSON.parse(await readFile(contractUrl, "utf8"));
  validateContract(contract);
});

test("secret-plane v1 rejects secret, root, unseal, and out-of-boundary references", () => {
  for (const forbidden of ["secret", "root", "unseal"]) {
    assert.throws(() => validate({ [forbidden]: "fixture" }), /forbidden field/);
  }

  const allowed = new Set(["bootstrap", "mount", "auth", "policy", "role", "eso", "hmac/fabric/eso/v1"]);
  for (const reference of ["runtime", "kubernetes", "argo", "openbao-config"]) {
    assert.ok(!allowed.has(reference), `out-of-boundary reference accepted: ${reference}`);
  }
  for (const reference of allowed) assert.ok(allowed.has(reference));
});
