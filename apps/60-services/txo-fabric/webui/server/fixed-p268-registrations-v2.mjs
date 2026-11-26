import cra from "../registrations/cra.json" with { type: "json" };
import credentialProjection from "../registrations/credential-projection.json" with { type: "json" };
import conversationKeySource from "../registrations/conversation-key-source.json" with { type: "json" };

// Exact reviewed source, copied byte-for-byte from this immutable candidate.
export const QUALIFIED_V2_COMMIT = "785ea25af3fe759ec07d0f66442909d6ccaa6725";
export const QUALIFIED_V2_DIRECT_PARENT = "bf068b84a5825246e9f6a09135d31d20e826f2a4";
export const QUALIFIED_V2_FILE_SHA256 = Object.freeze({
  cra: "ebbac53a40af68520266e7e7d22b7ea1118e9fb9e919a89c4100314dd74ea471",
  credentialProjection: "fe59be37c6a94e4037f03aa9c42a3ac00841db4c9c09593bb9902b6c29f0fb3d",
  conversationKeySource: "72acfc8ddb21c5ed8680a21a19f0dc738481ba26ef46bf4508c277ca8855d44b",
});

const freezeRegistration = registration => Object.freeze({
  ...registration,
  binding: Object.freeze({ ...registration.binding }),
  approval: Object.freeze({ ...registration.approval }),
  validity: Object.freeze({ ...registration.validity }),
  responsibilities: Object.freeze({ ...registration.responsibilities }),
  surfaces: Object.freeze([...registration.surfaces]),
});

export const qualifiedV2Registrations = Object.freeze([
  freezeRegistration(cra),
  freezeRegistration(credentialProjection),
  freezeRegistration(conversationKeySource),
]);
