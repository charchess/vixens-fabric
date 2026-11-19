const TEN=/^TEN[0-9]{5,}$/; const USER=/^usr[0-9]{6,}$/; const THREAD=/^[a-f0-9]{40}$/; const TURN=/^[a-f0-9]{32}$/;
const deny=()=>{throw new Error("Denied");};
export function createIdentityRosterConversation({tenantCatalog,bindingCAS,membership,roster,check,threads}={}){
 if([tenantCatalog,bindingCAS,membership,roster,check].some(x=>typeof x!=="function")||!["create","get","list","claim"].every(k=>typeof threads?.[k]==="function")) throw new Error("server-owned transactional dependencies required");
 async function principal(verified,tenantKey){
  if(!verified?.verified||typeof verified.issuer!=="string"||typeof verified.audience!=="string"||typeof verified.subject!=="string"||typeof verified.authentikUserUUID!=="string") deny();
  const t=(await tenantCatalog(verified.authentikUserUUID)).find(x=>x.tenantKey===tenantKey); if(!t||!TEN.test(t.fabricTenantId)||t.issuer!==verified.issuer||t.audience!==verified.audience||t.group!=="client0") deny();
  const b=await bindingCAS({tenantKey,fabricTenantId:t.fabricTenantId,issuer:t.issuer,audience:t.audience,subject:verified.subject,authentikUserUUID:verified.authentikUserUUID});
  if(!b||b.issuer!==t.issuer||!USER.test(b.fabricUserId)||typeof b.version!=="string") deny();
  const m=await membership({tenantKey,fabricTenantId:t.fabricTenantId,authentikUserUUID:verified.authentikUserUUID}); if(!m?.fresh||!m.active||!Array.isArray(m.groups)||!m.groups.includes("client0")) deny();
  return Object.freeze({tenantKey,fabricTenantId:t.fabricTenantId,fabricUserId:b.fabricUserId,bindingVersion:b.version});
 }
 async function canonical(p,key){const a=(await roster(p)).find(x=>x.agentKey===key);if(!a?.ready||typeof a.uid!=="string"||!Number.isInteger(a.generation)||await check({principal:p,agent:a,action:"agent.chat"})!==true)deny();return a;}
 async function rosterFor(p){const all=await roster(p),out=[];for(const a of all)if(a?.ready&&await check({principal:p,agent:a,action:"agent.chat"})===true)out.push(a);return out;}
 async function bound(p,id){if(!THREAD.test(id))deny();const t=await threads.get(id);if(!t||t.tenantKey!==p.tenantKey||t.fabricUserId!==p.fabricUserId||t.bindingVersion!==p.bindingVersion)deny();await canonical(p,t.agentKey);return t;}
 return Object.freeze({principal,roster:rosterFor,async create(p,key){const a=await canonical(p,key);const t=await threads.create({tenantKey:p.tenantKey,fabricTenantId:p.fabricTenantId,fabricUserId:p.fabricUserId,bindingVersion:p.bindingVersion,agentKey:a.agentKey,agentUID:a.uid,generation:a.generation});if(!THREAD.test(t?.id))deny();return t;},async read(p,id){return bound(p,id);},async resume(p,id){return bound(p,id);},async turn(p,id,turnId){if(!TURN.test(turnId)||await threads.claim({id,turnId})!==true)deny();return bound(p,id);}});
}
