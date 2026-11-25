import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFabricCanonicalCatalog } from "../server/fabric-canonical-catalog.mjs";
import { createFabricPostgresPool } from "../server/fabric-postgres-pool.mjs";

const tenant = Object.freeze({
  tenant_key: "hairem", fabric_tenant_id: "TEN00001",
  tenant_bundle_uid: "11111111-1111-4111-8111-111111111111",
});
const agent = Object.freeze({
  ...tenant, agent_key: "usr000001-agt00001",
  agent_uid: "22222222-2222-4222-8222-222222222222",
  generation: 7, observed_generation: 7, status: "Ready", deleting: false,
  active: true, retired_at: null, agent_active: true, agent_retired_at: null,
});
const user = "usr" + "a".repeat(32);
const principal = Object.freeze({ authenticated: true, verified: true, tenantKey: "hairem",
  fabricTenantId: "TEN00001", fabricUserId: user, subject: user });
function poolFor(resolver) {
  return Object.freeze({
    connect: async () => ({ query: async () => ({ rowCount: 0, rows: [] }), release() {} }),
    query: async (sql, params) => resolver(sql, params),
  });
}
function rowResult(row) { return { rowCount: 1, rows: [row] }; }

test("canonical catalog selects opaque immutable IDs only and permits a display rename", async () => {
  const calls = [];
  const catalog = createFabricCanonicalCatalog({ pool: poolFor((sql, params) => {
    calls.push({ sql, params });
    if (params.length === 2) return rowResult(tenant);
    if (params.length === 3 && params[2] === agent.agent_key) return rowResult(agent);
    if (params.length === 3 && params[2] === user) return { rowCount: 1, rows: [agent] };
    throw new Error("unexpected query");
  }) });
  assert.deepEqual(await catalog.resolveCanonicalTenant({ tenantKey: "hairem", fabricTenantId: "TEN00001" }),
    { tenantKey: "hairem", fabricTenantId: "TEN00001", uid: tenant.tenant_bundle_uid });
  const resolved = await catalog.resolveCanonicalAgent({ tenantKey: "hairem", fabricTenantId: "TEN00001", agentKey: agent.agent_key });
  assert.equal(resolved.uid, agent.agent_uid);
  assert.equal(resolved.agentKey, agent.agent_key);
  const listed = await catalog.listTenantAgents({ principal, tenantKey: "hairem", fabricTenantId: "TEN00001" });
  assert.deepEqual(listed.map(x => x.agentKey), [agent.agent_key]);
  assert.ok(calls.every(({ sql }) => !/display|alias|kubernetes|label/i.test(sql)));
});

test("canonical catalog refuses aliases, wrong keysets, cross-tenant rows and tombstones", async () => {
  const catalog = createFabricCanonicalCatalog({ pool: poolFor((sql, params) => {
    if (params.length === 2) return rowResult({ ...tenant, tenant_key: "indiba" });
    if (params.length === 3 && params[2] === agent.agent_key) {
      return rowResult({ ...agent, active: false, retired_at: "2026-01-01T00:00:00Z" });
    }
    return { rowCount: 0, rows: [] };
  }) });
  await assert.rejects(catalog.resolveCanonicalTenant({ tenantKey: "hairem", fabricTenantId: "TEN00001" }), /unavailable/);
  await assert.rejects(catalog.resolveCanonicalAgent({ tenantKey: "hairem", fabricTenantId: "TEN00001", agentKey: agent.agent_key }), /unavailable/);
  await assert.rejects(catalog.resolveCanonicalAgent({ tenantKey: "hairem", fabricTenantId: "TEN00001", agentKey: "renamed-display-label" }), /unavailable/);
  await assert.rejects(catalog.resolveCanonicalAgent({ tenantKey: "hairem", fabricTenantId: "TEN00001", agentKey: agent.agent_key, alias: agent.agent_key }), /unavailable/);
  await assert.rejects(catalog.listTenantAgents({ principal: { ...principal, displayName: "Alice" }, tenantKey: "hairem", fabricTenantId: "TEN00001" }), /unavailable/);
  await assert.rejects(catalog.listTenantAgents({ principal, tenantKey: "indiba", fabricTenantId: "TEN00002" }), /unavailable/);
});

test("catalog list is filtered by the exact verified principal", async () => {
  const catalog = createFabricCanonicalCatalog({ pool: poolFor((sql, params) => {
    assert.equal(params[2], user, "principal Fabric ID is the only list selector");
    return { rowCount: 1, rows: [agent] };
  }) });
  assert.equal((await catalog.listTenantAgents({ principal, tenantKey: "hairem", fabricTenantId: "TEN00001" })).length, 1);
  await assert.rejects(catalog.listTenantAgents({ principal: { ...principal, fabricUserId: "usr" + "b".repeat(32), subject: "usr" + "b".repeat(32) }, tenantKey: "hairem", fabricTenantId: "TEN00001" }), /unavailable/);
});

test("PostgreSQL pool accepts only the dedicated TLS runtime configuration", async () => {
  let received;
  class FakePool {
    constructor(config) { received = config; }
    query() {}
    connect() {}
  }
  const env = { PGHOST: "postgresql-shared-rw.databases.svc.cluster.local", PGPORT: "5432",
    PGDATABASE: "txo_fabric_webui", PGUSER: "txo_fabric_webui_runtime", PGSSLMODE: "require", PGPASSWORD: "test-only" };
  const pool = createFabricPostgresPool({ env, Pool: FakePool });
  assert.equal(pool.query instanceof Function, true);
  assert.equal(received.ssl.rejectUnauthorized, true);
  assert.equal(received.database, "txo_fabric_webui");
  assert.throws(() => createFabricPostgresPool({ env: { ...env, PGHOST: "other" }, Pool: FakePool }), /unavailable/);
  assert.throws(() => createFabricPostgresPool({ env: { ...env, PGSSLMODE: "disable" }, Pool: FakePool }), /unavailable/);
});

test("catalog migration preserves tombstones, immutable IDs and remains unselected", () => {
  const migration = readFileSync(new URL("../db/migrations/004_fabric_canonical_catalog.sql", import.meta.url), "utf8");
  const bootstrap = readFileSync(new URL("../bootstrap/migrate-job.yaml", import.meta.url), "utf8");
  const root = readFileSync(new URL("../kustomization.yaml", import.meta.url), "utf8");
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(migration, /records are tombstoned, not deleted/);
  assert.match(migration, /canonical identity is immutable/);
  assert.match(migration, /UNIQUE/);
  assert.match(migration, /REVOKE ALL ON TABLE/);
  assert.doesNotMatch(migration, /\b(DROP TABLE|TRUNCATE|PASSWORD|CREATE ROLE)\b/i);
  assert.doesNotMatch(bootstrap, /004_fabric_canonical_catalog/);
  assert.doesNotMatch(root, /004_fabric_canonical_catalog/);
});
