import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../../../", import.meta.url));
const migration = "004_fabric_browser_authority.sql";
const selected = (text) => [...text.matchAll(/psql\s+-X\s+-v\s+ON_ERROR_STOP=1\s+-f\s+\/migrations\/([^\s]+)/g)].map(match => match[1]);
const configMapFiles = (text) => [...text.matchAll(/^\s+-\s+([^=\s]+)=db\/migrations\/[^\s]+$/gm)].map(match => match[1]);

function assertAutomaticSelector({ catalog, runner }) {
  const files = configMapFiles(catalog);
  const commands = selected(runner);
  assert.deepEqual(files, [
    "001_oidc_login_transactions.sql",
    "002_global_browser_sessions.sql",
    "003_oidc_global_session_binding.sql"
  ]);
  assert.deepEqual(commands, files);
  assert.ok(!files.includes(migration), "ConfigMap catalog must not mount migration 004");
  assert.ok(!commands.includes(migration), "migration Job must not select migration 004");
}

test("real bootstrap selector cannot select browser authority migration", () => {
  const catalog = readFileSync(`${root}/apps/60-services/txo-fabric/webui/kustomization.yaml`, "utf8");
  const runner = readFileSync(`${root}/apps/60-services/txo-fabric/webui/bootstrap/migrate-job.yaml`, "utf8");
  assertAutomaticSelector({ catalog, runner });
  assert.match(runner, /suspend: true/);
  assert.match(readFileSync(`${root}/apps/60-services/txo-fabric/webui/bootstrap/kustomization.yaml`, "utf8"), /Deliberately not included in overlays\/prod/);
  assert.doesNotMatch(readFileSync(`${root}/apps/60-services/txo-fabric/webui/Dockerfile`, "utf8"), /migrations|psql/);
  assert.doesNotMatch(readFileSync(`${root}/apps/60-services/txo-fabric/webui/runtime/deployment.yaml`, "utf8"), /initContainers|migrations|psql/);
});

test("selector guard rejects an automatic migration-004 catalog entry", () => {
  const catalog = `files:\n  - 001_oidc_login_transactions.sql=db/migrations/001_oidc_login_transactions.sql\n  - 002_global_browser_sessions.sql=db/migrations/002_global_browser_sessions.sql\n  - 003_oidc_global_session_binding.sql=db/migrations/003_oidc_global_session_binding.sql\n  - ${migration}=db/migrations/${migration}\n`;
  const runner = `psql -X -v ON_ERROR_STOP=1 -f /migrations/001_oidc_login_transactions.sql\npsql -X -v ON_ERROR_STOP=1 -f /migrations/002_global_browser_sessions.sql\npsql -X -v ON_ERROR_STOP=1 -f /migrations/003_oidc_global_session_binding.sql\npsql -X -v ON_ERROR_STOP=1 -f /migrations/${migration}`;
  assert.throws(() => assertAutomaticSelector({ catalog, runner }), /Expected values to be strictly deep-equal/);
});

test("browser and bridge gates remain disabled", () => {
  const deployment = readFileSync(`${root}/apps/60-services/txo-fabric/webui/runtime/deployment.yaml`, "utf8");
  assert.match(deployment, /TXO_WEBUI_BFF_BROWSER_ENABLED\n\s+value: "false"/);
  assert.match(deployment, /TXO_FABRIC_PRIVATE_BRIDGE_ENABLED\n\s+value: "false"/);
});
