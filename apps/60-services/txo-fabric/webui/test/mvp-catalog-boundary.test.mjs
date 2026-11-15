import test from "node:test";
import assert from "node:assert/strict";
import { createMvpCatalogBoundary, MVP_CATALOG } from "../server/mvp-catalog-boundary.mjs";

const canonicalAgents = MVP_CATALOG.agentKeys.map((agentKey) => ({ agentKey, label: agentKey }));

test("MVP catalogue exposes only TEN00001 and the 13 canonical AgentIdentity keys", async () => {
  const boundary = createMvpCatalogBoundary({
    listTenantCatalog: async () => [
      { tenantKey: "hairem", fabricTenantId: "TEN00001", displayName: "hAIrem" },
      { tenantKey: "indiba", fabricTenantId: "TEN00002", displayName: "Indiba" },
      { tenantKey: "hairem", fabricTenantId: "TEN00999", displayName: "Forged hAIrem" },
    ],
    getTenantChat: async (scope) => ({
      ...scope,
      service: {},
      listTenantAgents: async () => [
        ...canonicalAgents,
        { agentKey: "usr000001-agt99999", label: "Out of roster" },
      ],
    }),
  });
  assert.deepEqual(await boundary.listTenantCatalog({ authentikUserUUID: "opaque" }), [
    { tenantKey: "hairem", fabricTenantId: "TEN00001", displayName: "hAIrem" },
  ]);
  assert.equal(await boundary.getTenantChat({ tenantKey: "indiba", fabricTenantId: "TEN00002" }), null);
  assert.equal(await boundary.getTenantChat({ tenantKey: "hairem", fabricTenantId: "TEN00999" }), null);
  const selected = await boundary.getTenantChat({ tenantKey: "hairem", fabricTenantId: "TEN00001" });
  const agents = await selected.listTenantAgents({});
  assert.deepEqual(agents.map(({ agentKey }) => agentKey), MVP_CATALOG.agentKeys);
  assert.equal(agents.length, 13);
});

test("MVP catalogue fails closed when private catalogues are malformed", async () => {
  const boundary = createMvpCatalogBoundary({
    listTenantCatalog: async () => ({ not: "an array" }),
    getTenantChat: async () => null,
  });
  await assert.rejects(boundary.listTenantCatalog({}), /Invalid private tenant catalog/);
  assert.throws(() => createMvpCatalogBoundary({}), /requires private resolvers/);
});
