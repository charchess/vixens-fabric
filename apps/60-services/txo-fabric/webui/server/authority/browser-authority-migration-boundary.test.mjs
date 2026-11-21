import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../../../", import.meta.url));
const automaticMigrations = [
  "001_oidc_login_transactions.sql",
  "002_global_browser_sessions.sql",
  "003_oidc_global_session_binding.sql"
];
const authorityMigration = "004_fabric_browser_authority.sql";
const read = (path) => readFileSync(`${root}/${path}`, "utf8");
const catalogEntries = (source) => [...source.matchAll(/^\s+-\s+([^=\s]+)=db\/migrations\/([^\s]+)$/gm)].map(([, name, sourceFile]) => ({ name, sourceFile }));
const jobSelections = (source) => [...source.matchAll(/psql\s+-X\s+-v\s+ON_ERROR_STOP=1\s+-f\s+\/migrations\/([^\s]+)/g)].map(([, name]) => name);

function assertBootstrapSelector(catalog, job) {
  const catalogNames = catalogEntries(catalog).map(({ name, sourceFile }) => {
    assert.equal(name, sourceFile, "catalog entry must not alias a migration filename");
    return name;
  });
  const selectedNames = jobSelections(job);
  assert.deepEqual(catalogNames, automaticMigrations, "ConfigMap catalog is the only mounted automatic migration set");
  assert.deepEqual(selectedNames, automaticMigrations, "Job must select the catalog in its exact reviewed order");
  assert.ok(!catalogNames.includes(authorityMigration));
  assert.ok(!selectedNames.includes(authorityMigration));
}

test("bootstrap ConfigMap catalog and migration Job refuse authority migration", () => {
  const catalog = read("apps/60-services/txo-fabric/webui/kustomization.yaml");
  const job = read("apps/60-services/txo-fabric/webui/bootstrap/migrate-job.yaml");
  assertBootstrapSelector(catalog, job);
  assert.match(job, /^\s*suspend: true$/m);
});

test("bootstrap selector rejects authority migration whether mounted or invoked", () => {
  const catalog = `files:\n${automaticMigrations.map(name => `  - ${name}=db/migrations/${name}`).join("\n")}\n`;
  const job = automaticMigrations.map(name => `psql -X -v ON_ERROR_STOP=1 -f /migrations/${name}`).join("\n");
  assert.throws(() => assertBootstrapSelector(`${catalog}  - ${authorityMigration}=db/migrations/${authorityMigration}\n`, job));
  assert.throws(() => assertBootstrapSelector(catalog, `${job}\npsql -X -v ON_ERROR_STOP=1 -f /migrations/${authorityMigration}`));
});

test("startup and delivery roots have no migration selector", () => {
  const dockerfile = read("apps/60-services/txo-fabric/webui/Dockerfile");
  assert.match(dockerfile, /^CMD \["node", "server\/private-bff-main\.mjs"\]$/m);
  const packageJson = JSON.parse(read("apps/60-services/txo-fabric/webui/package.json"));
  assert.deepEqual(packageJson.scripts, { test: "node --test", "start:private": "node server/private-bff-main.mjs" });
  const runtime = read("apps/60-services/txo-fabric/webui/runtime/kustomization.yaml");
  assert.deepEqual([...runtime.matchAll(/^\s+-\s+([^\s]+)$/gm)].map(([, resource]) => resource), ["serviceaccount.yaml", "deployment.yaml", "service.yaml", "ingress.yaml", "networkpolicy.yaml", "cilium-networkpolicy.yaml"]);
  const ci = read(".github/workflows/validate.yaml");
  assert.equal((ci.match(/browser-authority-migration-boundary\.test\.mjs/g) ?? []).length, 1);
  for (const release of [".github/workflows/release-dev.yaml", ".github/workflows/promote-prod.yaml"])
    assert.doesNotMatch(read(release), /\b(?:kubectl|helm|kustomize|psql)\b/);
});

test("browser and bridge gates remain disabled", () => {
  const deployment = read("apps/60-services/txo-fabric/webui/runtime/deployment.yaml");
  assert.match(deployment, /TXO_WEBUI_BFF_BROWSER_ENABLED\n\s+value: "false"/);
  assert.match(deployment, /TXO_FABRIC_PRIVATE_BRIDGE_ENABLED\n\s+value: "false"/);
});
