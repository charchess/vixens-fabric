import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const webui=new URL("../",import.meta.url);
const runtime=new URL("runtime/",webui);
const credentialsPath=new URL("bff-runtime-credentials.externalsecret.yaml",runtime);
const target="txo-fabric-webui-bff-runtime";
const expectedCredentials=[
  "apiVersion: external-secrets.io/v1", "kind: ExternalSecret", "metadata:",
  "name: txo-fabric-webui-bff-runtime-credentials", "namespace: txo-fabric-system", "annotations:",
  "argocd.argoproj.io/sync-wave: \"-15\"", "spec:", "refreshInterval: 60s", "secretStoreRef:",
  "name: openbao", "kind: ClusterSecretStore", "target:", `name: ${target}`,
  "creationPolicy: Owner", "deletionPolicy: Retain", "data:", "- secretKey: username", "remoteRef:",
  "key: vixens/prod/apps/60-services/txo-fabric/webui-bff", "property: runtime_username", "- secretKey: password",
  "remoteRef:", "key: vixens/prod/apps/60-services/txo-fabric/webui-bff", "property: runtime_password"
];
const expectedConsumer=[["PGUSER","username",undefined],["PGPASSWORD","password",undefined]];
const trimLines=source=>source.trim().split("\n").map(line=>line.trim()).filter(Boolean);

function assertClosedProducer(source){
  assert.deepEqual(trimLines(source),expectedCredentials);
  for(const forbidden of [/\b(?:dataFrom|find|extract|rewrite|template|generator|generators|provider|wildcard)\b/i,/[*?]/,/\b(?:Secret|Job|DatabaseRole|Application|AppProject)\b/]) assert.doesNotMatch(source,forbidden);
}

function credentialConsumers(source){
  return [...source.matchAll(new RegExp(`- name: (PGUSER|PGPASSWORD)\\n\\s+valueFrom:\\n\\s+secretKeyRef:\\n\\s+name: ${target}\\n\\s+key: (\\w+)(?:\\n\\s+optional: (\\w+))?`,"g"))].map(([,env,key,optional])=>[env,key,optional]);
}

test("BFF DB credential producer rejects expansion and provider bypass forms",()=>{
  const canonical=expectedCredentials.join("\n");
  assert.doesNotThrow(()=>assertClosedProducer(canonical));
  for(const addition of ["  dataFrom: []", "    find: {}", "    extract: {}", "    rewrite: []", "    template: {}", "    generatorRef: {}", "        key: vixens/prod/apps/*", "    name: alternate-store", "    kind: SecretStore"]) assert.throws(()=>assertClosedProducer(`${canonical}\n${addition}`));
});

test("BFF DB credentials have one closed producer and one non-optional BFF consumer",()=>{
  const credentials=readFileSync(credentialsPath,"utf8");
  assertClosedProducer(credentials);

  const kustomization=readFileSync(new URL("kustomization.yaml",runtime),"utf8");
  assert.deepEqual(trimLines(kustomization),["---","apiVersion: kustomize.config.k8s.io/v1beta1","kind: Kustomization","resources:","- serviceaccount.yaml","- bff-runtime-credentials.externalsecret.yaml","- deployment.yaml","- service.yaml","- ingress.yaml","- networkpolicy.yaml","- cilium-networkpolicy.yaml"]);
  assert.equal((kustomization.match(/bff-runtime-credentials\.externalsecret\.yaml/g)||[]).length,1);
  assert.doesNotMatch(kustomization,/(?:migration|Job|bootstrap)/i);

  const deployment=readFileSync(new URL("deployment.yaml",runtime),"utf8");
  const containerBlock=deployment.split("      containers:\n")[1].split("      volumes:\n")[0];
  assert.equal((containerBlock.match(/^        - name: /gm)||[]).length,1,"exactly one BFF container");
  assert.match(containerBlock,/^        - name: bff$/m);
  assert.deepEqual(credentialConsumers(deployment),expectedConsumer);
  assert.equal((deployment.match(new RegExp(`name: ${target}$`,"gm"))||[]).length,2);
  assert.doesNotMatch(deployment,/\benvFrom:/);
  assert.doesNotMatch(deployment,new RegExp(`secretName: ${target}`));
  assert.doesNotMatch(deployment,/- name: (?:PGUSER|PGPASSWORD)\n\s+value:/);
  assert.match(deployment,/name: TXO_WEBUI_BFF_BROWSER_ENABLED\s+value: "false"/);
  assert.match(deployment,/name: TXO_FABRIC_PRIVATE_BRIDGE_ENABLED\s+value: "false"/);

  const activeReferences=readdirSync(runtime).filter(name=>name.endsWith(".yaml")).flatMap(name=>{
    const source=readFileSync(new URL(name,runtime),"utf8");
    return [...source.matchAll(new RegExp(`^\\s+name: ${target}$`,"gm"))].map(()=>name);
  });
  assert.deepEqual(activeReferences,["bff-runtime-credentials.externalsecret.yaml","deployment.yaml","deployment.yaml"]);
  const migrator=readFileSync(new URL("bootstrap/migrate-job.yaml",webui),"utf8");
  assert.doesNotMatch(migrator,new RegExp(target));

  const render=spawnSync("kustomize",["build",webui.pathname],{encoding:"utf8"});
  assert.equal(render.status,0,render.stderr);
  assert.equal((render.stdout.match(/kind: ExternalSecret/g)||[]).length,1);
  const producer=render.stdout.split(/^---$/m).find(document=>/kind: ExternalSecret\n/.test(document));
  const bff=render.stdout.split(/^---$/m).find(document=>/kind: Deployment\n/.test(document));
  assert.ok(producer); assert.ok(bff);
  assert.equal((producer.match(/secretKey: (?:username|password)/g)||[]).length,2);
  assert.equal((producer.match(/property: runtime_(?:username|password)/g)||[]).length,2);
  const renderedConsumers=[...bff.matchAll(new RegExp(`- name: (PGUSER|PGPASSWORD)\\n\\s+valueFrom:\\n\\s+secretKeyRef:\\n\\s+key: (\\w+)\\n\\s+name: ${target}(?:\\n\\s+optional: (\\w+))?`,"g"))].map(([,env,key,optional])=>[env,key,optional]);
  assert.deepEqual(renderedConsumers,expectedConsumer);
  for(const forbidden of [/kind: (?:Secret|Job|DatabaseRole)/,/\b(?:dataFrom|find|extract|rewrite|template|generator|generators)\b/i,/[*?]/]) assert.doesNotMatch(producer,forbidden);
  assert.doesNotMatch(bff,/\benvFrom:/);
  assert.doesNotMatch(bff,new RegExp(`secretName: ${target}`));
});
