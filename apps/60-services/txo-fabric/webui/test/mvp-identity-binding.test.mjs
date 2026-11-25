import test from "node:test";
import assert from "node:assert/strict";
import { createMvpIdentityBinding } from "../server/mvp-identity-binding.mjs";

const binding = Object.freeze({
  issuer: "https://authentik.truxonline.com/application/o/txo-fabric-webui/",
  oidcSubject: "opaque-charchess-subject",
  authentikUserUUID: "00000000-0000-4000-8000-000000000001",
  fabricUserId: "usr" + "a".repeat(32),
  tenantKey: "hairem", fabricTenantId: "TEN00001", requiredGroup: "hairem/admin",
});
const identity = Object.freeze({
  authenticated: true, verified: true,
  issuer: binding.issuer, oidcSubject: binding.oidcSubject,
  authentikUserUUID: binding.authentikUserUUID,
});

test("MVP binding accepts only the complete exact provisioned tuple", () => {
  const recognizer = createMvpIdentityBinding({ bindings: [binding] });
  assert.deepEqual(recognizer.recognize(identity), {
    ...identity, fabricUserId: binding.fabricUserId, tenantKey: "hairem",
    fabricTenantId: "TEN00001", requiredGroup: "hairem/admin",
  });
  for (const bad of [
    {}, { ...identity, oidcSubject: "other" },
    { ...identity, authentikUserUUID: "00000000-0000-4000-8000-000000000002" },
    { ...identity, issuer: "https://evil.example/" },
    { ...identity, fabricUserId: binding.fabricUserId },
  ]) assert.equal(recognizer.recognize(bad), null);
});

test("MVP binding rejects empty, synthetic, wrong-tenant or wrong-group configuration", () => {
  for (const bindings of [
    [], [{ ...binding, requiredGroup: "client0" }],
    [{ ...binding, tenantKey: "other" }],
    [{ ...binding, fabricTenantId: "TEN00002" }],
    [{ ...binding, fabricUserId: "synthetic" }],
  ]) assert.throws(() => createMvpIdentityBinding({ bindings }), /MVP identity binding unavailable/);
});
