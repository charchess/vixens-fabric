import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const path = new URL("../../contracts/browser-authority-binding-contract.md", import.meta.url);
const text = () => readFileSync(path, "utf8");

test("browser authority binding contract is bounded, source-only and fail-closed", () => {
  const doc = text();
  for (const phrase of [
    "BrowserSessionCapability", "BindingScope", "Data-authority split",
    "Bootstrap-only Client0", "State machine", "CAS tuple", "unique constraints",
    "Server route rules", "Three internal operations", "fail closed",
    "No provider implementation", "No migration", "Gates remain false",
  ]) assert.match(doc, new RegExp(phrase));
  for (const phrase of ["issuer", "audience", "subject", "bindingVersion", "tenantKey", "fabricTenantId", "fabricUserId"]) assert.match(doc, new RegExp(`\\b${phrase}\\b`));
  for (const forbidden of [
    /https:\/\/authentik\.truxonline\.com/i, /TEN00001/, /usr000001/, /hmac-key/i,
    /ExternalSecret/, /OpenBao/, /TXO_WEBUI_BFF_BROWSER_ENABLED=true/,
    /TXO_FABRIC_PRIVATE_BRIDGE_ENABLED=true/, /kind:\s*(Deployment|Job|Secret)/,
  ]) assert.doesNotMatch(doc, forbidden);
});
