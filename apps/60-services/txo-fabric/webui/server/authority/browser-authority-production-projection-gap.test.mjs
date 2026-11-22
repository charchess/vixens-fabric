import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createProductionBFFApp } from "../private-bff-server.mjs";

const source = relative => readFile(new URL(relative, import.meta.url), "utf8");

test("false/false remains a hard Browser Authority isolation boundary", async () => {
  const off = await createProductionBFFApp({ env: {
    TXO_WEBUI_BFF_BROWSER_ENABLED: "false",
    TXO_FABRIC_PRIVATE_BRIDGE_ENABLED: "false",
  } });
  assert.deepEqual(off, { enabled: false, app: null });

  const bff = await source("../private-bff-server.mjs");
  assert.doesNotMatch(bff, /browser-authority-production\.mjs/);
  assert.match(bff, /if \(!enabled\) return Object\.freeze\(\{ enabled: false, app: null \}\);/);
});

test("canonical BrowserTenant authority is private while public catalog shape remains unchanged", async () => {
  const canonical = await source("../../../operator/internal/controller/tenantbundle_canonical_browser_authority.go");
  assert.match(canonical, /type CanonicalBrowserTenantAuthority struct/);
  for (const field of ["TenantKey", "FabricTenantID", "TenantBundleUID", "OIDCIssuer", "OIDCClientID", "ObservedGeneration"]) {
    assert.match(canonical, new RegExp(`${field}\\s+\\S+\\s+\`json:"-"\``));
  }
  assert.match(canonical, /func resolveCanonicalBrowserTenantAuthority\(bundle \*fabricv1alpha1\.TenantBundle, now time\.Time\)/);
  assert.doesNotMatch(canonical, /privatebridge|http\.Client|fetch|database\/sql|OpenFGA|Secret/);

  const publicContract = await source("../../../operator/internal/privatebridge/browser.go");
  const browserTenant = publicContract.match(/type BrowserTenant struct \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(browserTenant, /TenantKey\s+string\s+`json:"tenantKey"`/);
  assert.match(browserTenant, /FabricTenantID\s+string\s+`json:"fabricTenantId"`/);
  assert.match(browserTenant, /DisplayName\s+string\s+`json:"displayName"`/);
  assert.doesNotMatch(browserTenant, /TenantBundleUID|OIDCIssuer|OIDCClientID|ObservedGeneration|CanonicalBrowserTenantAuthority/);
});
