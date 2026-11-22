import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createProductionBrowserAuthority } from "./browser-authority-production.mjs";
import { createProductionBFFApp } from "../private-bff-server.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const source = relative => readFile(new URL(relative, import.meta.url), "utf8");

test("false/false remains a hard production-authority isolation boundary", async () => {
  assert.equal(createProductionBrowserAuthority.length, 0);
  assert.throws(() => createProductionBrowserAuthority(), /Browser authority denied/);

  const off = await createProductionBFFApp({ env: {
    TXO_WEBUI_BFF_BROWSER_ENABLED: "false",
    TXO_FABRIC_PRIVATE_BRIDGE_ENABLED: "false",
  } });
  assert.deepEqual(off, { enabled: false, app: null });

  const bff = await source("../private-bff-server.mjs");
  assert.doesNotMatch(bff, /browser-authority-production\.mjs/);
  assert.match(bff, /if \(!enabled\) return Object\.freeze\(\{ enabled: false, app: null \}\);/);
});

test("production composition remains blocked by the canonical TenantBundle projection contract", async () => {
  const core = await source("./browser-authority-core.mjs");
  assert.match(core, /"tenantBundleUID"/);
  assert.match(core, /"issuer","audience"/);

  const projection = await readFile(new URL("../../../operator/internal/privatebridge/browser.go", import.meta.url), "utf8");
  const tenant = projection.match(/type BrowserTenant struct \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(tenant, /TenantKey\s+string/);
  assert.match(tenant, /FabricTenantID\s+string/);
  assert.doesNotMatch(tenant, /TenantBundleUID|Issuer|Audience/);

  const resolver = await readFile(new URL("../../../operator/internal/controller/tenantbundle_private_browser_authority.go", import.meta.url), "utf8");
  assert.match(resolver, /func browserTenant\(b \*fabricv1alpha1\.TenantBundle\) privatebridge\.BrowserTenant/);
  assert.match(resolver, /TenantKey: b\.Name, FabricTenantID: b\.Spec\.TenantID, DisplayName: b\.Spec\.DisplayName/);
  assert.doesNotMatch(resolver, /TenantBundleUID:/);
});
