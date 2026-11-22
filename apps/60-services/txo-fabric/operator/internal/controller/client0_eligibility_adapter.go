package controller

import (
 "context"
 "errors"
 "reflect"
 "time"
 fabricv1alpha1 "github.com/charchess/vixens/apps/60-services/txo-fabric/operator/api/v1alpha1"
 "github.com/charchess/vixens/apps/60-services/txo-fabric/operator/internal/authentik"
 "k8s.io/apimachinery/pkg/types"
)
var errClient0EligibilityUnavailable=errors.New("client0 eligibility unavailable")
type client0VerifiedTuple struct{Issuer,Audience,Subject,AuthentikUserUUID string}
func client0EligibilityFromCanonicalReadSet(b *fabricv1alpha1.TenantBundle,t client0VerifiedTuple,user string,pins map[string]string,first,second authentik.GroupMembership)(Client0BootstrapEligibility,error){
 if b==nil||b.Name==""||b.UID==""||b.Generation<1||b.Status.ObservedGeneration!=b.Generation||b.DeletionTimestamp!=nil||b.Spec.HumanAccess==nil||b.Spec.HumanAccess.Web==nil||user==""||t.Issuer==""||t.Audience==""||t.Subject==""||t.AuthentikUserUUID=="" {return Client0BootstrapEligibility{},errClient0EligibilityUnavailable}
 w:=b.Spec.HumanAccess.Web; ref:=w.Client0BootstrapGroupRef; count:=0;for _,g:=range w.IAMGroups{if g==ref{count++}};if ref==""||count!=1||pins[ref]==""||first.Name!=ref||first.AuthentikGroupUUID!=pins[ref]||!reflect.DeepEqual(first,second){return Client0BootstrapEligibility{},errClient0EligibilityUnavailable}
 member:=false;for _,id:=range first.ActiveAuthentikUserUUIDs{if id==t.AuthentikUserUUID{member=true}};if !member{return Client0BootstrapEligibility{},errClient0EligibilityUnavailable}
 return EvaluateClient0BootstrapEligibility(Client0BootstrapEligibilityRequest{TenantKey:b.Name,TenantBundleUID:string(b.UID),Issuer:t.Issuer,Audience:t.Audience,Subject:t.Subject,Client0BootstrapGroupRef:ref,DeclaredIAMGroups:w.IAMGroups,ObservedGeneration:b.Status.ObservedGeneration,Generation:b.Generation,Ready:true,ReadOnlyMemberships:[]string{ref}})
}
// client0BootstrapEligibility reloads canonical state and is intentionally not wired to a bridge or route.
func (r *TenantBundleReconciler) client0BootstrapEligibility(ctx context.Context,tenantKey string,t client0VerifiedTuple,now time.Time)(Client0BootstrapEligibility,error){
 if r==nil||r.Client==nil||tenantKey==""||now.IsZero(){return Client0BootstrapEligibility{},errClient0EligibilityUnavailable};reader:=r.APIReader;if reader==nil{reader=r.Client};var b fabricv1alpha1.TenantBundle;if err:=reader.Get(ctx,types.NamespacedName{Name:tenantKey},&b);err!=nil||!privateAuthorizationConditionFresh(b.Status.Conditions,b.Generation,now){return Client0BootstrapEligibility{},errClient0EligibilityUnavailable};if b.Spec.HumanAccess==nil||b.Spec.HumanAccess.Web==nil||t.Issuer!=b.Spec.HumanAccess.Web.OIDC.Issuer||t.Audience!=b.Spec.HumanAccess.Web.OIDC.ClientID{return Client0BootstrapEligibility{},errClient0EligibilityUnavailable};reg,err:=r.readOpenFGAHumanIdentityRegistry(ctx,&b);if err!=nil{return Client0BootstrapEligibility{},errClient0EligibilityUnavailable};user,err:=reg.ResolveAuthentikUserUUID(t.AuthentikUserUUID);if err!=nil{return Client0BootstrapEligibility{},errClient0EligibilityUnavailable};pins,err:=r.readOpenFGAIAMGroupPins(ctx,&b);if err!=nil{return Client0BootstrapEligibility{},errClient0EligibilityUnavailable};src,err:=r.authentikMembershipSource(ctx);if err!=nil{return Client0BootstrapEligibility{},errClient0EligibilityUnavailable};ref:=b.Spec.HumanAccess.Web.Client0BootstrapGroupRef;one,err:=src.SnapshotGroupMembership(ctx,ref);if err!=nil{return Client0BootstrapEligibility{},errClient0EligibilityUnavailable};two,err:=src.SnapshotGroupMembership(ctx,ref);if err!=nil{return Client0BootstrapEligibility{},errClient0EligibilityUnavailable};return client0EligibilityFromCanonicalReadSet(&b,t,user,pins,one,two)
}
