// MVP catalogue boundary. The identifiers below are copied verbatim from
// tenants/hairem/agents.yaml, the canonical Fabric AgentIdentity source.
// This is deliberately a closed allowlist: the BFF must not turn a broader
// private-registry response into cross-tenant or out-of-roster discovery.
const TENANT_KEY = "hairem";
const TENANT_ID = "TEN00001";
const AGENT_KEYS = Object.freeze(new Set([
  "usr000001-agt00001", "usr000001-agt00002", "usr000001-agt00003",
  "usr000001-agt00004", "usr000001-agt00005", "usr000001-agt00006",
  "usr000001-agt00007", "usr000001-agt00008", "usr000001-agt00009",
  "usr000001-agt00010", "usr000001-agt00011", "usr000001-agt00012",
  "usr000001-agt00013",
]));

export const MVP_CATALOG = Object.freeze({
  tenantKey: TENANT_KEY,
  fabricTenantId: TENANT_ID,
  agentKeys: Object.freeze([...AGENT_KEYS]),
});

const isMvpTenant = (entry) => entry && entry.tenantKey === TENANT_KEY &&
  entry.fabricTenantId === TENANT_ID;

/**
 * Restrict the browser composition to the reviewed POC cell. This does not
 * grant access: callers still perform active-account, pinned IAM and FGA
 * checks for each request. It only ensures a broader or malformed backend
 * response cannot become discovery surface in this MVP.
 */
export function createMvpCatalogBoundary({ listTenantCatalog, getTenantChat } = {}) {
  if (typeof listTenantCatalog !== "function" || typeof getTenantChat !== "function") {
    throw new Error("MVP catalog boundary requires private resolvers");
  }
  return Object.freeze({
    async listTenantCatalog(identity) {
      const entries = await listTenantCatalog(identity);
      if (!Array.isArray(entries)) throw new Error("Invalid private tenant catalog");
      return entries.filter(isMvpTenant);
    },
    async getTenantChat(scope) {
      if (!isMvpTenant(scope)) return null;
      const selected = await getTenantChat(scope);
      if (!selected || !isMvpTenant(selected) || typeof selected.listTenantAgents !== "function") return null;
      return Object.freeze({
        ...selected,
        async listTenantAgents(input) {
          const agents = await selected.listTenantAgents(input);
          if (!Array.isArray(agents)) throw new Error("Invalid private agent catalog");
          return agents.filter((agent) => agent && typeof agent.agentKey === "string" && AGENT_KEYS.has(agent.agentKey));
        },
      });
    },
  });
}
