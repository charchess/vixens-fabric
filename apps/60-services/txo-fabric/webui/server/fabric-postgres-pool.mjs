import pg from "pg";

const HOST = "postgresql-shared-rw.databases.svc.cluster.local";
const DATABASE = "txo_fabric_webui";
const USER = "txo_fabric_webui_runtime";
const fail = () => { throw new Error("Fabric PostgreSQL pool unavailable"); };

function configFrom(env) {
  if (!env || typeof env !== "object" || Array.isArray(env) ||
      env.PGHOST !== HOST || env.PGPORT !== "5432" ||
      env.PGDATABASE !== DATABASE || env.PGUSER !== USER ||
      env.PGSSLMODE !== "require" || typeof env.PGPASSWORD !== "string" ||
      env.PGPASSWORD.length < 1 || env.PGPASSWORD.length > 1024 ||
      /[\0\r\n]/.test(env.PGPASSWORD)) fail();
  return Object.freeze({
    host: HOST,
    port: 5432,
    database: DATABASE,
    user: USER,
    password: env.PGPASSWORD,
    ssl: Object.freeze({ rejectUnauthorized: true }),
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    application_name: "txo-fabric-webui-bff",
  });
}

/**
 * Creates the only BFF PostgreSQL pool. The pool uses the narrow runtime role;
 * migrations use a separate role. No URL, browser value, fallback database or
 * caller-selected TLS setting is accepted. Optional arguments are test seams.
 */
export function createFabricPostgresPool({ env = process.env, Pool = pg.Pool } = {}) {
  if (typeof Pool !== "function") fail();
  let pool;
  try { pool = new Pool(configFrom(env)); } catch { fail(); }
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") fail();
  return pool;
}
