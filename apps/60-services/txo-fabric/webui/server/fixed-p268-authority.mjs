import { qualifiedV2Registrations } from "./fixed-p268-registrations-v2.mjs";

const CONTRACT_VERSION = "fabric.registration/v2";
const REQUIRED_SURFACES = Object.freeze({
  cra: Object.freeze(["resolveCanonicalTenant", "resolveCanonicalAgent", "verifyEndpoint", "authorizeScopedCredentialRead"]),
  credentialProjection: Object.freeze(["readPrivateCredential"]),
  conversationKeySource: Object.freeze(["deriveConversationKey"]),
});
const REQUIRED_MODULES = Object.freeze({
  cra: "src/cra.js",
  credentialProjection: "src/credential-projection.js",
  conversationKeySource: "src/conversation-key-source.js",
});
const REQUIRED_RESPONSIBILITIES = Object.freeze({
  registrationRuntimeEvidence: "Electra",
  authorityCode: "Fabric operator",
  futureBffFactory: "Mira",
  futureBffFactoryStatus: "future-only-no-consumption-or-assembly",
});

const unavailable = () => { throw new Error("Authoritative Fabric Responses providers unavailable"); };
const ownExact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const exactArray = (actual, expected) => Array.isArray(actual) && actual.length === expected.length &&
  actual.every((value, index) => value === expected[index]);
const validUtc = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function validateFixedRegistrationSet(registrations, { now = Date.now(), verifyProvenance } = {}) {
  const nowMillis = typeof now === "number" ? now : now?.getTime?.();
  if (!Number.isFinite(nowMillis) || !Array.isArray(registrations) ||
      registrations.length !== 3 || typeof verifyProvenance !== "function") unavailable();
  const seen = new Set();
  for (const registration of registrations) {
    const required = registration && REQUIRED_SURFACES[registration.kind];
    let provenance = false;
    try { provenance = verifyProvenance(registration) === true; } catch { unavailable(); }
    if (!required || seen.has(registration.kind) || registration.contractVersion !== CONTRACT_VERSION ||
        typeof registration.registrationRevision !== "string" || !/^[0-9a-f]{40}$/.test(registration.registrationRevision) ||
        typeof registration.providerSourceRevision !== "string" || !/^[0-9a-f]{40}$/.test(registration.providerSourceRevision) ||
        registration.directParent !== registration.providerSourceRevision || registration.module !== REQUIRED_MODULES[registration.kind] ||
        registration.sourceCanonical !== "fabric-immutable-registration-authority" ||
        !ownExact(registration.binding, ["type", "ref"]) || registration.binding.type !== "private-bff-binding-ref" ||
        registration.binding.ref !== "fabric-bff-private-v1" || !ownExact(registration.approval, ["approver", "approvedAt"]) ||
        registration.approval.approver !== "charchess" || !validUtc(registration.approval.approvedAt) ||
        !ownExact(registration.validity, ["expiresAt", "revocationMode"]) || !validUtc(registration.validity.expiresAt) ||
        Date.parse(registration.validity.expiresAt) <= nowMillis ||
        registration.validity.revocationMode !== "deny-on-revoked-or-unavailable" || registration.revoked !== false ||
        !ownExact(registration.responsibilities, Object.keys(REQUIRED_RESPONSIBILITIES)) ||
        Object.keys(REQUIRED_RESPONSIBILITIES).some(key => registration.responsibilities[key] !== REQUIRED_RESPONSIBILITIES[key]) ||
        !exactArray(registration.surfaces, required) || !provenance) unavailable();
    seen.add(registration.kind);
  }
  return Object.freeze(registrations.map(registration => Object.freeze({
    kind: registration.kind, module: registration.module, surfaces: registration.surfaces,
  })));
}

function buildFixedP268AuthorityForTest(registrations, physicalCapabilities, admissionContext = {
  now: Date.now(), verifyProvenance: registration => qualifiedV2Registrations.includes(registration),
}) {
  const admitted = registrations === qualifiedV2Registrations
    ? Object.freeze(qualifiedV2Registrations.map(registration => Object.freeze({
      kind: registration.kind, module: registration.module, surfaces: registration.surfaces,
    })))
    : validateFixedRegistrationSet(registrations, admissionContext);
  if (!physicalCapabilities || typeof physicalCapabilities !== "object" ||
      typeof physicalCapabilities.createCra !== "function" ||
      typeof physicalCapabilities.createCredentialProjection !== "function" ||
      typeof physicalCapabilities.createConversationKeySource !== "function") unavailable();
  const cra = physicalCapabilities.createCra(admitted[0]);
  const credentialProjection = physicalCapabilities.createCredentialProjection(admitted[1]);
  const conversationKeySource = physicalCapabilities.createConversationKeySource(admitted[2]);
  if (!cra || !credentialProjection || !conversationKeySource) unavailable();
  return Object.freeze({ cra, credentialProjection, conversationKeySource });
}

/**
 * The only production-reachable P268 authority factory. It consumes the reviewed
 * V2 registrations fixed in source, accepts no graph, and denies before any
 * listener or Responses I/O because physical capabilities are not in this slice.
 */
export function createFixedP268Authority() {
  if (arguments.length !== 0) unavailable();
  validateFixedRegistrationSet(qualifiedV2Registrations, {
    verifyProvenance: registration => qualifiedV2Registrations.includes(registration),
  });
  unavailable();
}
