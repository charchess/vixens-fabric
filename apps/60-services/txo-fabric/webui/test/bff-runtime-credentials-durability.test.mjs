import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const webui=new URL("../",import.meta.url);
const runtime=new URL("runtime/",webui);
const target="txo-fabric-webui-bff-runtime";
const storeName="openbao-fabric-webui-bff-runtime-store";
const externalSecretName="txo-fabric-webui-bff-runtime-credentials-dedicated";
const trimLines=source=>source.trim().split("\n").map(line=>line.trim()).filter(Boolean);
const expectedStore=[
  "apiVersion: external-secrets.io/v1", "kind: SecretStore", "metadata:", `name: ${storeName}`, "namespace: txo-fabric-system", "spec:", "provider:", "vault:",
  "server: https://openbao-fabric.txo-fabric-system.svc:8200", "path: fabric", "version: v2", "auth:", "tokenSecretRef:", "name: txo-fabric-webui-bff-runtime-eso-token", "key: token"
];
const expectedExternalSecret=[
  "apiVersion: external-secrets.io/v1", "kind: ExternalSecret", "metadata:", `name: ${externalSecretName}`, "namespace: txo-fabric-system", "annotations:",
  "argocd.argoproj.io/sync-wave: \"-15\"", "spec:", "refreshInterval: 60s", "secretStoreRef:", `name: ${storeName}`, "kind: SecretStore", "target:", `name: ${target}`,
  "creationPolicy: Owner", "deletionPolicy: Retain", "data:", "- secretKey: username", "remoteRef:", "key: vixens/prod/apps/60-services/txo-fabric/webui-bff", "property: runtime_username",
  "- secretKey: password", "remoteRef:", "key: vixens/prod/apps/60-services/txo-fabric/webui-bff", "property: runtime_password"
];
const expectedConsumer=[["PGUSER","username",undefined],["PGPASSWORD","password",undefined]];

function assertClosed(source,expected){
  assert.deepEqual(trimLines(source),expected);
  for(const forbidden of [/\b(?:dataFrom|find|extract|rewrite|template|generator|generators|wildcard)\b/i,/[*?]/,/\bClusterSecretStore\b/,/\b(?:Job|DatabaseRole|Application|AppProject)\b/]) assert.doesNotMatch(source,forbidden);
}
function consumerRefs(source){
  return [...source.matchAll(new RegExp(`- name: (PGUSER|PGPASSWORD)\\n\\s+valueFrom:\\n\\s+secretKeyRef:\\n\\s+name: ${target}\\n\\s+key: (\\w+)(?:\\n\\s+optional: (\\w+))?`,"g"))].map(([,env,key,optional])=>[env,key,optional]);
}

test("dedicated BFF custody rejects shared-store and producer expansion fixtures",()=>{
  const store=expectedStore.join("\n");
  const externalSecret=expectedExternalSecret.join("\n");
  assert.doesNotThrow(()=>assertClosed(store,expectedStore));
  assert.doesNotThrow(()=>assertClosed(externalSecret,expectedExternalSecret));
  for(const addition of ["  kind: ClusterSecretStore", "  dataFrom: []", "    find: {}", "    extract: {}", "    rewrite: []", "    template: {}", "    generatorRef: {}", "        key: vixens/prod/apps/*", "    name: shared-openbao"]) assert.throws(()=>assertClosed(`${externalSecret}\n${addition}`,expectedExternalSecret));
});

test("dedicated BFF custody has one Store, one producer, and one non-optional BFF consumer",()=>{
  const store=readFileSync(new URL("bff-runtime-credentials.secretstore.yaml",runtime),"utf8");
  const externalSecret=readFileSync(new URL("bff-runtime-credentials.externalsecret.yaml",runtime),"utf8");
  const deployment=readFileSync(new URL("deployment.yaml",runtime),"utf8");
  const kustomization=readFileSync(new URL("kustomization.yaml",runtime),"utf8");
  assertClosed(store,expectedStore);
  assertClosed(externalSecret,expectedExternalSecret);
  assert.deepEqual(trimLines(kustomization),["---","apiVersion: kustomize.config.k8s.io/v1beta1","kind: Kustomization","resources:","- serviceaccount.yaml","- bff-runtime-credentials.secretstore.yaml","- bff-runtime-credentials.externalsecret.yaml","- deployment.yaml","- service.yaml","- ingress.yaml","- networkpolicy.yaml","- cilium-networkpolicy.yaml"]);
  assert.deepEqual(consumerRefs(deployment),expectedConsumer);
  assert.doesNotMatch(deployment,/\benvFrom:/);
  assert.doesNotMatch(deployment,new RegExp(`secretName: ${target}`));
  assert.doesNotMatch(deployment,/- name: (?:PGUSER|PGPASSWORD)\n\s+value:/);
  assert.match(deployment,/name: TXO_WEBUI_BFF_BROWSER_ENABLED\s+value: "false"/);
  assert.match(deployment,/name: TXO_FABRIC_PRIVATE_BRIDGE_ENABLED\s+value: "false"/);
  const active= readdirSync(runtime).filter(name=>name.endsWith(".yaml")).flatMap(name=>{
    const source=readFileSync(new URL(name,runtime),"utf8");
    return [...source.matchAll(new RegExp(`^\\s+name: (?:${storeName}|${externalSecretName}|${target})$`,"gm"))].map(match=>[name,match[0].trim().replace(/^name: /,"")]);
  });
  assert.deepEqual(active,[["bff-runtime-credentials.externalsecret.yaml",externalSecretName],["bff-runtime-credentials.externalsecret.yaml",storeName],["bff-runtime-credentials.externalsecret.yaml",target],["bff-runtime-credentials.secretstore.yaml",storeName],["deployment.yaml",target],["deployment.yaml",target]]);
  assert.doesNotMatch(readFileSync(new URL("bootstrap/migrate-job.yaml",webui),"utf8"),new RegExp(`${storeName}|${externalSecretName}|${target}`));

  const render=spawnSync("kustomize",["build",webui.pathname],{encoding:"utf8"});
  assert.equal(render.status,0,render.stderr);
  assert.equal((render.stdout.match(/^kind: SecretStore$/gm)||[]).length,1);
  assert.equal((render.stdout.match(/kind: ExternalSecret/g)||[]).length,1);
  const documents=render.stdout.split(/^---$/m);
  const renderedStore=documents.find(document=>/kind: SecretStore\n/.test(document));
  const renderedExternalSecret=documents.find(document=>/kind: ExternalSecret\n/.test(document));
  const renderedBff=documents.find(document=>/kind: Deployment\n/.test(document));
  assert.ok(renderedStore); assert.ok(renderedExternalSecret); assert.ok(renderedBff);
  assert.match(renderedStore,new RegExp(`name: ${storeName}`));
  assert.match(renderedExternalSecret,new RegExp(`name: ${externalSecretName}`));
  assert.match(renderedExternalSecret,new RegExp(`name: ${storeName}`));
  const renderedConsumers=[...renderedBff.matchAll(new RegExp(`- name: (PGUSER|PGPASSWORD)\\n\\s+valueFrom:\\n\\s+secretKeyRef:\\n\\s+key: (\\w+)\\n\\s+name: ${target}(?:\\n\\s+optional: (\\w+))?`,"g"))].map(([,env,key,optional])=>[env,key,optional]);
  assert.deepEqual(renderedConsumers,expectedConsumer);
});
