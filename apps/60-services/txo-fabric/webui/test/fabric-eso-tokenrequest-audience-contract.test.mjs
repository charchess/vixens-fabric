import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const plane=new URL("../../openbao-fabric/overlays/prod/secret-plane/",import.meta.url);
const read=p=>readFileSync(new URL(p,plane),"utf8");
test("Fabric ESO projection keeps exact audience and a single HMAC consumer",()=>{
 const store=read("secret-store.yaml"),rbac=read("eso-tokenrequest-rbac.yaml"),projection=read("bridge-assertion.externalsecret.yaml"),policy=read("openbao-client-networkpolicy.yaml");
 assert.match(store,/serviceAccountRef:\n\s+name: txo-fabric-eso\n\s+audiences:\n\s+- https:\/\/kubernetes\.default\.svc/);
 assert.match(store,/mountPath: kubernetes/);assert.match(store,/role: txo-fabric-eso-webui-bff/);assert.match(store,/path: fabric/);
 assert.match(rbac,/resources: \["serviceaccounts\/token"\]/);assert.match(rbac,/resourceNames: \["txo-fabric-eso"\]/);assert.match(rbac,/verbs: \["create"\]/);
 assert.match(projection,/kind: ExternalSecret/);assert.match(projection,/secretKey: hmac-key/);assert.equal((projection.match(/remoteRef:/g)||[]).length,1);
 assert.match(policy,/kubernetes.io\/metadata.name: external-secrets/);assert.match(policy,/app.kubernetes.io\/name: external-secrets/);assert.equal((policy.match(/port: 8200/g)||[]).length,2);
});
