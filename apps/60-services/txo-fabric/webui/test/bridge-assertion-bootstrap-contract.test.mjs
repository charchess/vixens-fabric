import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
test("bridge bootstrap contract is non-applied, exact and least privilege",()=>{
 const policy=read("openbao-fabric/contracts/bridge-assertion-read.hcl.example");
 const example=read("openbao-fabric/contracts/bridge-assertion.externalsecret.yaml.example");
 const active=read("openbao-fabric/overlays/prod/secret-plane/kustomization.yaml");
 assert.match(policy,/SOURCE-ONLY \/ NOT INSTALLED/);assert.match(policy,/path "fabric\/data\/platform\/txo-fabric\/webui-bff\/bridge-assertion"/);assert.match(policy,/capabilities = \["read"\]/);assert.doesNotMatch(policy,/list|create|update|delete|sudo|metadata/);
 assert.match(example,/SOURCE-ONLY \/ NOT APPLIED/);assert.match(example,/kind: ExternalSecret/);assert.equal(example.match(/kind: ExternalSecret/g)?.length,1);assert.match(example,/name: openbao-fabric-store/);assert.match(example,/kind: SecretStore/);assert.match(example,/name: txo-fabric-private-bridge-assertion/);assert.match(example,/secretKey: hmac-key/);assert.match(example,/key: platform\/txo-fabric\/webui-bff\/bridge-assertion/);assert.match(example,/property: hmac-key/);
 for(const bad of [/dataFrom:/,/find:/,/template:/,/ClusterSecretStore/,/token:/,/value:/,/stringData:/,/hmac-key:\s*[^\n]/])assert.doesNotMatch(example,bad);
 assert.doesNotMatch(active,/bridge-assertion|txo-fabric-private-bridge-assertion|ExternalSecret/);
});
