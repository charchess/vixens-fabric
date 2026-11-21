import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../../../../", import.meta.url));
const migration = "004_fabric_browser_authority.sql";
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]); }
function assertNoSelection(text, path) { assert.doesNotMatch(text, /004_fabric_browser_authority\.sql/, `${path} must not select migration 004`); }
test("browser authority migration remains unselected by startup and delivery paths", () => {
  for (const rel of [".github/workflows", "scripts", "apps/60-services/txo-fabric/webui/bootstrap", "apps/60-services/txo-fabric/webui/runtime"])
    for (const path of files(`${root}/${rel}`)) assertNoSelection(readFileSync(path, "utf8"), path);
  assert.throws(() => assertNoSelection(`apply ${migration}`, "synthetic-startup"));
  const deployment = readFileSync(`${root}/apps/60-services/txo-fabric/webui/runtime/deployment.yaml`, "utf8");
  assert.match(deployment, /TXO_WEBUI_BFF_BROWSER_ENABLED\n\s+value: "false"/);
  assert.match(deployment, /TXO_FABRIC_PRIVATE_BRIDGE_ENABLED\n\s+value: "false"/);
});
