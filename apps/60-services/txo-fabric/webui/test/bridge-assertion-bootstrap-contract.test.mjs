import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
test("bridge assertion bootstrap is one Fabric-store record, source-only and least privilege",()=>{
 const policy=read("openbao-fabric/contracts/bridge-assertion-read.hcl.example");
 const es=read("openbao-fabric/overlays/prod/secret-plane/bridge-assertion.externalsecret.yaml");
 const store=read("openbao-fabric/overlays/prod/secret-plane/secret-store.yaml");
 const sa=read("openbao-fabric/overlays/prod/secret-plane/eso-identity.yaml");
 const k=read("openbao-fabric/overlays/prod/secret-plane/kustomization.yaml");
 assert.match(policy,/SOURCE-ONLY \/ NOT INSTALLED/);assert.match(policy,/path "fabric\/data\/platform\/txo-fabric\/webui-bff\/bridge-assertion"/);assert.match(policy,/capabilities = \["read"\]/);assert.doesNotMatch(policy,/list|create|update|delete|sudo|metadata/);
 assert.match(es,/kind: ExternalSecret/);assert.equal(es.match(/kind: ExternalSecret/g)?.length,1);assert.match(es,/name: txo-fabric-private-bridge-assertion/);assert.match(es,/namespace: txo-fabric-system/);assert.match(es,/name: openbao-fabric-store/);assert.match(es,/kind: SecretStore/);assert.match(es,/secretKey: hmac-key/);assert.match(es,/key: platform\/txo-fabric\/webui-bff\/bridge-assertion/);assert.match(es,/property: hmac-key/);
 for(const bad of [/dataFrom:/,/find:/,/template:/,/ClusterSecretStore/,/token:/,/value:/,/stringData:/,/hmac-key:\s*[^\n]/])assert.doesNotMatch(es,bad);
 assert.match(store,/path: fabric/);assert.match(store,/mountPath: kubernetes/);assert.match(store,/role: txo-fabric-eso-webui-bff/);assert.match(store,/name: txo-fabric-eso/);assert.match(sa,/namespace: txo-fabric-system/);assert.match(k,/bridge-assertion\.externalsecret\.yaml/);
});
