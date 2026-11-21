import { createBrowserAuthorityForTest } from "./browser-authority-core.mjs";
// This fixed production seam deliberately has no provider configuration in source.
// Runtime composition is separately reviewed; absence must deny before any listener.
const fixed=()=>null;
export function createProductionBrowserAuthority(){const collaborators=fixed();if(!collaborators)throw Error("Browser authority denied");return createBrowserAuthorityForTest(collaborators)}
