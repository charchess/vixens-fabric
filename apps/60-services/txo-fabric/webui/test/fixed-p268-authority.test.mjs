import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createFixedP268Authority } from "../server/fixed-p268-authority.mjs";
import {
  QUALIFIED_V2_COMMIT, QUALIFIED_V2_DIRECT_PARENT, QUALIFIED_V2_FILE_SHA256, qualifiedV2Registrations,
} from "../server/fixed-p268-registrations-v2.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const webui = dirname(here);
const now = new Date("2026-11-25T18:20:00Z");

async function loadLocalTestSeam() {
  const source = await readFile(join(webui, "server/fixed-p268-authority.mjs"), "utf8");
  const registrations = JSON.stringify(structuredClone(qualifiedV2Registrations));
  const seamSource = source
    .replace(/^import .*?;\n/, `const qualifiedV2Registrations = ${registrations};\n`)
    .replace("export function createFixedP268Authority", "function createFixedP268Authority")
    + "\nexport { createFixedP268Authority, buildFixedP268AuthorityForTest, qualifiedV2Registrations };\n";
  return import(`data:text/javascript;base64,${Buffer.from(seamSource).toString("base64")}`);
}

function fixtureSet() { return structuredClone(qualifiedV2Registrations); }
function admission() {
  return {
    now: now.getTime(),
    verifyProvenance(registration) {
      return qualifiedV2Registrations.some(expected => expected.kind === registration.kind
        && expected.registrationRevision === registration.registrationRevision
        && expected.providerSourceRevision === registration.providerSourceRevision
        && expected.directParent === registration.directParent
        && expected.module === registration.module);
    },
  };
}
function capabilities(calls) {
  return {
    createCra() { calls.cra++; return Object.freeze({ private: "cra" }); },
    createCredentialProjection() { calls.credential++; return Object.freeze({ private: "credential" }); },
    createConversationKeySource() { calls.key++; return Object.freeze({ private: "key" }); },
  };
}

for (const [file, expected] of Object.entries(QUALIFIED_V2_FILE_SHA256)) {
  test(`consumes byte-identical reviewed V2 ${file} registration`, async () => {
    const filename = file === "credentialProjection" ? "credential-projection.json"
      : file === "conversationKeySource" ? "conversation-key-source.json" : "cra.json";
    const bytes = await readFile(join(webui, "registrations", filename));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
  });
}

test("records exact immutable V2 candidate lineage", () => {
  assert.equal(QUALIFIED_V2_COMMIT, "785ea25af3fe759ec07d0f66442909d6ccaa6725");
  assert.equal(QUALIFIED_V2_DIRECT_PARENT, "bf068b84a5825246e9f6a09135d31d20e826f2a4");
  assert.deepEqual(qualifiedV2Registrations.map(item => item.surfaces.length), [4, 1, 1]);
  assert.equal(qualifiedV2Registrations.flatMap(item => item.surfaces).includes("keyMaterial"), false);
});

test("production boundary is zero-argument and never accepts a provider graph", () => {
  const graph = new Proxy({}, { get() { throw Error("injection inspected"); } });
  assert.throws(() => createFixedP268Authority(), /providers unavailable/);
  assert.throws(() => createFixedP268Authority(graph), /providers unavailable/);
});

test("local test seam constructs only from a valid V2 registration binding", async () => {
  const { buildFixedP268AuthorityForTest, qualifiedV2Registrations: seamRegistrations } = await loadLocalTestSeam();
  const calls = { cra: 0, credential: 0, key: 0 };
  const authority = buildFixedP268AuthorityForTest(seamRegistrations, capabilities(calls), {
    now: 0, verifyProvenance: () => true,
  });
  assert.deepEqual(calls, { cra: 1, credential: 1, key: 1 });
  assert.deepEqual(Object.keys(authority), ["cra", "credentialProjection", "conversationKeySource"]);
});

for (const [label, mutate] of [
  ["registration set absent", set => set.splice(0)],
  ["unknown registration", set => { set[0].kind = "unknown"; }],
  ["divergent registration", set => { set[0].module = "src/forged.js"; }],
  ["stale registration", set => { set[1].validity.expiresAt = "2026-11-25T18:19:59Z"; }],
  ["calendar-invalid expiry", set => { set[1].validity.expiresAt = "2027-02-30T00:00:00Z"; }],
  ["revoked registration", set => { set[2].revoked = true; }],
  ["unavailable revocation", set => { delete set[2].validity.revocationMode; }],
  ["unknown version", set => { set[0].contractVersion = "fabric.registration/v99"; }],
]) {
  test(`local test seam denies ${label} before physical capability construction`, async () => {
    const { buildFixedP268AuthorityForTest } = await loadLocalTestSeam();
    const calls = { cra: 0, credential: 0, key: 0 };
    const set = fixtureSet(); mutate(set);
    assert.throws(() => buildFixedP268AuthorityForTest(set, capabilities(calls), admission()), /providers unavailable/);
    assert.deepEqual(calls, { cra: 0, credential: 0, key: 0 });
  });
}

test("local test seam denies unknown authority or handle failures", async () => {
  const { buildFixedP268AuthorityForTest, qualifiedV2Registrations: seamRegistrations } = await loadLocalTestSeam();
  assert.throws(() => buildFixedP268AuthorityForTest(seamRegistrations, {}), /providers unavailable/);
  const calls = { cra: 0, credential: 0, key: 0 };
  const failing = capabilities(calls);
  failing.createCredentialProjection = () => { calls.credential++; throw Error("opaque handle denied"); };
  assert.throws(() => buildFixedP268AuthorityForTest(seamRegistrations, failing), /opaque handle denied/);
  assert.deepEqual(calls, { cra: 1, credential: 1, key: 0 });
});

test("local test seam denies missing or throwing V2 provenance before capability construction", async () => {
  const { buildFixedP268AuthorityForTest } = await loadLocalTestSeam();
  for (const context of [{ now: now.getTime() }, { now: now.getTime(), verifyProvenance() { throw Error("unavailable"); } }]) {
    const calls = { cra: 0, credential: 0, key: 0 };
    assert.throws(() => buildFixedP268AuthorityForTest(fixtureSet(), capabilities(calls), context), /providers unavailable/);
    assert.deepEqual(calls, { cra: 0, credential: 0, key: 0 });
  }
});
