import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const controller = readFileSync(new URL(
  "../../operator/internal/controller/tenantbundle_authentik.go", import.meta.url), "utf8");

test("Fabric operator publishes the independent global WebUI OIDC blueprint", () => {
  assert.match(controller, /id: txo-fabric-webui-provider/);
  assert.match(controller, /client_id: txo-fabric-webui/);
  assert.match(controller, /client_type: public/);
  assert.match(controller, /grant_types:\\n        - authorization_code\\n      property_mappings/);
  assert.match(controller, /slug: txo-fabric-webui/);
  assert.match(controller, /scope_name: txo_fabric_identity/);
  assert.match(controller, /return \{\\"txo_fabric_user_uuid\\": str\(request\.user\.uuid\)\}/);
  assert.match(controller, /url: https:\/\/fabric\.truxonline\.com\/auth\/callback/);
  assert.match(controller, /matching_mode: strict/);
  assert.doesNotMatch(controller, /webui\.truxonline\.com/);
});

test("global browser blueprint is retained even when no tenant bundle is active", () => {
  assert.match(controller, /global Fabric browser OIDC blueprint is valid without a tenant/);
  assert.doesNotMatch(controller, /if len\(active\) == 0 \{[\s\S]{0,300}apierrors\.IsNotFound/);
});
