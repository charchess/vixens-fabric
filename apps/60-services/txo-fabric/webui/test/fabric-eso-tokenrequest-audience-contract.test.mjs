import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
const plane=new URL("../../openbao-fabric/overlays/prod/secret-plane/",import.meta.url);
const read=p=>readFileSync(new URL(p,plane),"utf8");
test("Fabric Store TokenRequest audience is schema-correct and validation-only",()=>{
 const store=read("secret-store.yaml"),rbac=read("eso-tokenrequest-rbac.yaml");
 const contract=read("../../../contracts/workload-authz-matrix.md");
 assert.match(store,/serviceAccountRef:\n\s+name: txo-fabric-eso\n\s+audiences:\n\s+- https:\/\/kubernetes\.default\.svc/);
 assert.match(store,/mountPath: kubernetes/);assert.match(store,/role: txo-fabric-eso-webui-bff/);assert.match(store,/path: fabric/);
 assert.match(rbac,/resources: \["serviceaccounts\/token"\]/);assert.match(rbac,/resourceNames: \["txo-fabric-eso"\]/);assert.match(rbac,/verbs: \["create"\]/);
 for(const phrase of ["TokenRequest audience", "https://kubernetes.default.svc", "validation-only", "No ExternalSecret", "target Secret", "KV"])assert.match(contract,new RegExp(phrase));
 const all=readdirSync(plane,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>readFileSync(join(plane.pathname,e.name),"utf8")).join("\n");
 for(const forbidden of [/kind: ExternalSecret/,/remoteRef:/,/target:\n\s+name:/,/TXO_WEBUI_BFF_BROWSER_ENABLED:\s*"true"/,/TXO_FABRIC_PRIVATE_BRIDGE_ENABLED:\s*"true"/])assert.doesNotMatch(all,forbidden);
});
