import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

const root=new URL("../../../../../",import.meta.url);
const file=new URL("apps/60-services/txo-fabric/webui/browser-authority-004-intent/activation-intent.yaml",root);
const excluded=":!apps/60-services/txo-fabric/webui/browser-authority-004-intent/**";
const command="node --test apps/60-services/txo-fabric/webui/browser-authority-004-intent/browser-authority-004-intent.test.mjs";
const escapeRegExp=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const releaseTupleReference=new RegExp(`^scripts/test-release-channel\\.py:\\d+:\\s*["']${escapeRegExp(command)}["']\\s*,?\\s*$`);
const workflowReference=/^\.github\/workflows\/validate\.yaml:.*node --test .*browser-authority-004-intent\.test\.mjs$/;

function assertReleaseTupleReferenceFixtures(){
  assert.match(`scripts/test-release-channel.py:177:        "${command}",`,releaseTupleReference);
  for(const reference of [
    `scripts/test-release-channel.py:177:        "${command}" + " --watch",`,
    `scripts/test-release-channel.py:177:        "${command}", # consumer`,
    "scripts/test-release-channel.py:177:        'node --test alternate.test.mjs',",
  ]) assert.doesNotMatch(reference,releaseTupleReference);
}

test("release-channel tuple reference regex accepts only the canonical literal fixture",()=>{
  assertReleaseTupleReferenceFixtures();
});

test("004 intent is a closed non-executable record and has no consumer",async()=>{
  const x=await readFile(file,"utf8");
  const lines=x.trim().split("\n").map(line=>line.trim()).filter(Boolean);
  assert.deepEqual(lines,["apiVersion: fabric.truxonline.io/v1alpha1","kind: BrowserAuthority004ActivationIntent","metadata:","name: browser-authority-004","spec:","executable: false","renderRefusal: true","namespace: txo-fabric-system","databaseProfileRef: postgresql-shared","migrationSource: ../db/migrations/004_fabric_browser_authority.sql","migrationDigest: ABSENT_EXTERNAL_CONTRACT_REQUIRED","networkPolicyReference: ../runtime/networkpolicy.yaml","credentialReference: ABSENT_EXTERNAL_CONTRACT_REQUIRED","databaseRole: ABSENT_EXTERNAL_CONTRACT_REQUIRED","activationAuthority: ABSENT_EXTERNAL_CONTRACT_REQUIRED","gates:","browserEnabled: false","privateBridgeEnabled: false"]);
  assert.doesNotMatch(x,/\b(Job|Application|AppProject|Role|RoleBinding|ClusterRole|image|serviceAccount|containers|resources|syncPolicy|automated)\b/);
  const scan=spawnSync("git",["grep","-n","browser-authority-004-intent","--",excluded],{cwd:new URL(".",root).pathname,encoding:"utf8"});
  const references=(scan.stdout||"").trim().split("\n").filter(Boolean);
  const releaseChannel=await readFile(new URL("scripts/test-release-channel.py",root),"utf8");
  assert.doesNotMatch(releaseChannel,new RegExp(`validate\\.count\\(["']${escapeRegExp(command)}["'],\\s*1\\)`));
  if(releaseChannel.includes(command)){
    const authorityTests=new RegExp(`authority_tests\\s*=\\s*[\\[(][\\s\\S]*?["']${escapeRegExp(command)}["'][\\s\\S]*?[\\])]`);
    assert.match(releaseChannel,authorityTests);
    assert.match(releaseChannel,/validate\.count\(authority_test\)\s*!=\s*1/);
  }
  const allowed=[workflowReference,releaseTupleReference];
  for(const reference of references) assert.ok(allowed.some(pattern=>pattern.test(reference)),reference);
  for(const pattern of allowed) assert.ok(references.filter(reference=>pattern.test(reference)).length<=1,"duplicate allowlisted reference");
  assert.ok(scan.status===0||scan.status===1);
});
