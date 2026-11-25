const TENANT_KEY = /^[a-z0-9](?:[a-z0-9-]{0,54}[a-z0-9])?$/;
const TENANT_ID = /^TEN[0-9]{5,}$/;
const AGENT_KEY = /^[a-z0-9](?:[a-z0-9-]{0,54}[a-z0-9])?$/;
const USER_ID = /^usr[a-f0-9]{32}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i;
const fail = () => { throw new Error("Fabric canonical catalog unavailable"); };
const own = (value, fields) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).sort().join(",") === [...fields].sort().join(",");

function tenantInput(input) {
  if (!own(input, ["tenantKey", "fabricTenantId"]) || !TENANT_KEY.test(input.tenantKey) ||
      !TENANT_ID.test(input.fabricTenantId) || input.fabricTenantId.length > 64) fail();
  return [input.tenantKey, input.fabricTenantId];
}
function agentInput(input) {
  if (!own(input, ["tenantKey", "fabricTenantId", "agentKey"]) ||
      !AGENT_KEY.test(input.agentKey)) fail();
  return [...tenantInput({ tenantKey: input.tenantKey, fabricTenantId: input.fabricTenantId }), input.agentKey];
}
function principalInput(input) {
  if (!own(input, ["principal", "tenantKey", "fabricTenantId"])) fail();
  const [tenantKey, fabricTenantId] = tenantInput({ tenantKey: input.tenantKey, fabricTenantId: input.fabricTenantId });
  const principal = input.principal;
  if (!own(principal, ["authenticated", "verified", "tenantKey", "fabricTenantId", "fabricUserId", "subject"]) ||
      principal.authenticated !== true || principal.verified !== true ||
      principal.tenantKey !== tenantKey || principal.fabricTenantId !== fabricTenantId ||
      !USER_ID.test(principal.fabricUserId || "") || principal.subject !== principal.fabricUserId) fail();
  return [tenantKey, fabricTenantId, principal.fabricUserId];
}
function exactlyOne(result) {
  if (!result || result.rowCount !== 1 || !Array.isArray(result.rows) || result.rows.length !== 1) fail();
  return result.rows[0];
}
function resultList(result) {
  if (!result || !Number.isSafeInteger(result.rowCount) || result.rowCount < 0 ||
      !Array.isArray(result.rows) || result.rows.length !== result.rowCount) fail();
  return result.rows;
}
function tenant(row) {
  if (!row || row.tenant_key === undefined || row.fabric_tenant_id === undefined ||
      row.tenant_bundle_uid === undefined || !TENANT_KEY.test(row.tenant_key) ||
      !TENANT_ID.test(row.fabric_tenant_id) || !UUID.test(row.tenant_bundle_uid)) fail();
  return Object.freeze({ tenantKey: row.tenant_key, fabricTenantId: row.fabric_tenant_id, uid: row.tenant_bundle_uid });
}
function agent(row, expected) {
  if (!row || !TENANT_KEY.test(row.tenant_key || "") || !TENANT_ID.test(row.fabric_tenant_id || "") ||
      !AGENT_KEY.test(row.agent_key || "") || !UUID.test(row.tenant_bundle_uid || "") ||
      !UUID.test(row.agent_uid || "") || !Number.isSafeInteger(row.generation) || row.generation < 1 ||
      row.observed_generation !== row.generation || row.status !== "Ready" || row.deleting !== false ||
      row.active !== true || row.retired_at !== null || row.agent_active !== true || row.agent_retired_at !== null ||
      row.tenant_key !== expected[0] || row.fabric_tenant_id !== expected[1] ||
      row.agent_key !== expected[2]) fail();
  return Object.freeze({
    tenantKey: row.tenant_key, fabricTenantId: row.fabric_tenant_id,
    tenantBundleUID: row.tenant_bundle_uid, agentKey: row.agent_key, uid: row.agent_uid,
    generation: row.generation, observedGeneration: row.observed_generation,
    status: row.status, deleting: row.deleting,
  });
}

const ACTIVE_TENANT = `tenant_key=$1 AND fabric_tenant_id=$2 AND active=true AND retired_at IS NULL`;
const ACTIVE_AGENT = `${ACTIVE_TENANT} AND agent_key=$3 AND agent_active=true AND agent_retired_at IS NULL`;

/**
 * Canonical catalog provider. It only queries immutable, server-managed IDs;
 * display names, aliases, Kubernetes names and browser input never select a
 * record. Tombstones remain stored but are never resolvable or listable.
 */
export function createFabricCanonicalCatalog({ pool } = {}) {
  if (typeof pool?.query !== "function" || typeof pool?.connect !== "function") fail();
  async function query(sql, params) {
    try { return await pool.query(sql, params); } catch { fail(); }
  }
  return Object.freeze({
    async resolveCanonicalTenant(input = {}) {
      const key = tenantInput(input);
      const row = exactlyOne(await query(`SELECT tenant_key, fabric_tenant_id, tenant_bundle_uid
        FROM txo_fabric_catalog_tenants WHERE ${ACTIVE_TENANT}`, key));
      const resolved = tenant(row);
      if (resolved.tenantKey !== key[0] || resolved.fabricTenantId !== key[1]) fail();
      return resolved;
    },
    async resolveCanonicalAgent(input = {}) {
      const key = agentInput(input);
      const row = exactlyOne(await query(`SELECT t.tenant_key, t.fabric_tenant_id, t.tenant_bundle_uid,
          a.agent_key, a.agent_uid, a.generation, a.observed_generation, a.status, a.deleting,
          t.active, t.retired_at, a.active AS agent_active, a.retired_at AS agent_retired_at
        FROM txo_fabric_catalog_agents AS a
        JOIN txo_fabric_catalog_tenants AS t ON t.fabric_tenant_id=a.fabric_tenant_id
        WHERE ${ACTIVE_AGENT}`, key));
      return agent(row, key);
    },
    async listTenantAgents(input = {}) {
      const [tenantKey, fabricTenantId, fabricUserId] = principalInput(input);
      const rows = resultList(await query(`SELECT t.tenant_key, t.fabric_tenant_id, t.tenant_bundle_uid,
          a.agent_key, a.agent_uid, a.generation, a.observed_generation, a.status, a.deleting,
          t.active, t.retired_at, a.active AS agent_active, a.retired_at AS agent_retired_at
        FROM txo_fabric_catalog_agent_grants AS g
        JOIN txo_fabric_catalog_agents AS a
          ON a.fabric_tenant_id=g.fabric_tenant_id AND a.agent_key=g.agent_key
        JOIN txo_fabric_catalog_tenants AS t ON t.fabric_tenant_id=a.fabric_tenant_id
        WHERE g.fabric_tenant_id=$2 AND g.fabric_user_id=$3 AND g.active=true
          AND ${ACTIVE_AGENT}
        ORDER BY a.agent_key ASC`, [tenantKey, fabricTenantId, fabricUserId]));
      return Object.freeze(rows.map(row => agent(row, [tenantKey, fabricTenantId, row.agent_key])));
    },
  });
}
