const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SUBJECT = /^[!-~]{1,255}$/;
const USER = /^usr[0-9a-f]{32}$/;
const deny = () => { throw new Error("MVP identity binding unavailable"); };

/**
 * Creates the only accepted MVP global identity recognizer. Authoritative
 * opaque IDs are injected by a separately provisioned private resolver; this
 * source intentionally contains no synthetic identity or fallback mapping.
 */
export function createMvpIdentityBinding({ bindings } = {}) {
  if (!Array.isArray(bindings) || bindings.length !== 1) deny();
  const [binding] = bindings;
  if (!binding || typeof binding !== "object" || Array.isArray(binding) ||
      Object.keys(binding).sort().join(",") !== "authentikUserUUID,fabricTenantId,fabricUserId,issuer,oidcSubject,requiredGroup,tenantKey" ||
      typeof binding.issuer !== "string" || !binding.issuer.startsWith("https://") ||
      typeof binding.oidcSubject !== "string" || !SUBJECT.test(binding.oidcSubject) ||
      typeof binding.authentikUserUUID !== "string" || !UUID.test(binding.authentikUserUUID) ||
      typeof binding.fabricUserId !== "string" || !USER.test(binding.fabricUserId) ||
      binding.tenantKey !== "hairem" || binding.fabricTenantId !== "TEN00001" ||
      binding.requiredGroup !== "hairem/admin") deny();
  const canonical = Object.freeze({
    authenticated: true, verified: true,
    issuer: binding.issuer, oidcSubject: binding.oidcSubject,
    authentikUserUUID: binding.authentikUserUUID,
    fabricUserId: binding.fabricUserId, tenantKey: binding.tenantKey,
    fabricTenantId: binding.fabricTenantId, requiredGroup: binding.requiredGroup,
  });
  return Object.freeze({
    recognize(identity) {
      if (!identity || typeof identity !== "object" || Array.isArray(identity) ||
          identity.authenticated !== true || identity.verified !== true ||
          identity.issuer !== canonical.issuer || identity.oidcSubject !== canonical.oidcSubject ||
          identity.authentikUserUUID !== canonical.authentikUserUUID ||
          identity.tenantKey !== undefined || identity.fabricUserId !== undefined) return null;
      return canonical;
    },
  });
}
