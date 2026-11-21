import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
test("bridge assertion projection is exact, minimal and bridge-off",()=>{
 const active=read("openbao-fabric/overlays/prod/secret-plane/kustomization.yaml");
 const projection=read("openbao-fabric/overlays/prod/secret-plane/bridge-assertion.externalsecret.yaml");
 assert.match(active,/bridge-assertion\.externalsecret\.yaml/);
 assert.match(projection,/kind: ExternalSecret/); assert.match(projection,/name: txo-fabric-private-bridge-assertion/);
 assert.match(projection,/name: openbao-fabric-store/); assert.match(projection,/secretKey: hmac-key/);
 assert.match(projection,/key: platform\/txo-fabric\/webui-bff\/bridge-assertion/); assert.match(projection,/property: hmac-key/);
 for(const bad of [/dataFrom:/,/find:/,/template:/,/ClusterSecretStore/,/token:/,/value:/,/stringData:/,/TXO_WEBUI_BFF_BROWSER_ENABLED/,/TXO_FABRIC_PRIVATE_BRIDGE_ENABLED/]) assert.doesNotMatch(projection,bad);
});
