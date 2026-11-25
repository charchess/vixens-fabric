-- 004: authoritative opaque Fabric catalog for the future BFF. This migration
-- is additive and deliberately NOT selected by the currently suspended schema
-- Job. Electra must separately approve activation after catalog import review.
-- IDs are never inferred from display names, aliases, Kubernetes object names,
-- browser input, email or OIDC subject. Runtime receives SELECT only.

CREATE TABLE IF NOT EXISTS txo_fabric_catalog_tenants (
  fabric_tenant_id varchar(64) PRIMARY KEY,
  tenant_key varchar(56) NOT NULL UNIQUE,
  tenant_bundle_uid uuid NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  retired_at timestamptz,
  CONSTRAINT catalog_tenant_id_valid CHECK (fabric_tenant_id ~ '^TEN[0-9]{5,}$'),
  CONSTRAINT catalog_tenant_key_valid CHECK (tenant_key ~ '^[a-z0-9]([a-z0-9-]{0,54}[a-z0-9])?$'),
  CONSTRAINT catalog_tenant_lifecycle_valid CHECK (
    (active=true AND retired_at IS NULL) OR (active=false AND retired_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS txo_fabric_catalog_agents (
  fabric_tenant_id varchar(64) NOT NULL REFERENCES txo_fabric_catalog_tenants(fabric_tenant_id) ON DELETE RESTRICT,
  agent_key varchar(56) NOT NULL,
  agent_uid uuid NOT NULL UNIQUE,
  generation bigint NOT NULL,
  observed_generation bigint NOT NULL,
  status varchar(16) NOT NULL,
  deleting boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  retired_at timestamptz,
  PRIMARY KEY (fabric_tenant_id, agent_key),
  CONSTRAINT catalog_agent_key_valid CHECK (agent_key ~ '^[a-z0-9]([a-z0-9-]{0,54}[a-z0-9])?$'),
  CONSTRAINT catalog_agent_generation_valid CHECK (generation > 0 AND observed_generation = generation),
  CONSTRAINT catalog_agent_status_valid CHECK (status = 'Ready'),
  CONSTRAINT catalog_agent_lifecycle_valid CHECK (
    (active=true AND retired_at IS NULL AND deleting=false) OR
    (active=false AND retired_at IS NOT NULL)
  )
);

-- A principal is granted an opaque agent key, never an alias or display label.
CREATE TABLE IF NOT EXISTS txo_fabric_catalog_agent_grants (
  fabric_tenant_id varchar(64) NOT NULL,
  agent_key varchar(56) NOT NULL,
  fabric_user_id varchar(35) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (fabric_tenant_id, agent_key, fabric_user_id),
  FOREIGN KEY (fabric_tenant_id, agent_key) REFERENCES txo_fabric_catalog_agents(fabric_tenant_id, agent_key) ON DELETE RESTRICT,
  CONSTRAINT catalog_grant_user_valid CHECK (fabric_user_id ~ '^usr[a-f0-9]{32}$')
);
CREATE INDEX IF NOT EXISTS txo_catalog_grants_principal
  ON txo_fabric_catalog_agent_grants (fabric_tenant_id, fabric_user_id, agent_key) WHERE active=true;

-- Tombstones are durable: no delete and no rewrite of an identity tuple. A
-- lifecycle transition can only retire an existing row, never reactivate it.
CREATE OR REPLACE FUNCTION txo_fabric_catalog_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Fabric catalog records are tombstoned, not deleted'; END IF;
  IF TG_TABLE_NAME = 'txo_fabric_catalog_tenants' THEN
    IF NEW.fabric_tenant_id <> OLD.fabric_tenant_id OR NEW.tenant_key <> OLD.tenant_key OR
       NEW.tenant_bundle_uid <> OLD.tenant_bundle_uid OR (OLD.active=false AND NEW.active=true) THEN
      RAISE EXCEPTION 'Fabric tenant canonical identity is immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'txo_fabric_catalog_agents' THEN
    IF NEW.fabric_tenant_id <> OLD.fabric_tenant_id OR NEW.agent_key <> OLD.agent_key OR
       NEW.agent_uid <> OLD.agent_uid OR (OLD.active=false AND NEW.active=true) THEN
      RAISE EXCEPTION 'Fabric agent canonical identity is immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS txo_catalog_tenant_immutable ON txo_fabric_catalog_tenants;
CREATE TRIGGER txo_catalog_tenant_immutable BEFORE UPDATE OR DELETE ON txo_fabric_catalog_tenants
  FOR EACH ROW EXECUTE FUNCTION txo_fabric_catalog_immutable();
DROP TRIGGER IF EXISTS txo_catalog_agent_immutable ON txo_fabric_catalog_agents;
CREATE TRIGGER txo_catalog_agent_immutable BEFORE UPDATE OR DELETE ON txo_fabric_catalog_agents
  FOR EACH ROW EXECUTE FUNCTION txo_fabric_catalog_immutable();

REVOKE ALL ON TABLE txo_fabric_catalog_tenants FROM PUBLIC;
REVOKE ALL ON TABLE txo_fabric_catalog_agents FROM PUBLIC;
REVOKE ALL ON TABLE txo_fabric_catalog_agent_grants FROM PUBLIC;
