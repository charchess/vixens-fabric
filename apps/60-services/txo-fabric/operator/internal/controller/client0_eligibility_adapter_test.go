package controller

import (
 "testing"
 fabricv1alpha1 "github.com/charchess/vixens/apps/60-services/txo-fabric/operator/api/v1alpha1"
 "github.com/charchess/vixens/apps/60-services/txo-fabric/operator/internal/authentik"
 metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)
func TestClient0EligibilityFromCanonicalReadSetRejectsAuthorityGaps(t *testing.T){
 b:=&fabricv1alpha1.TenantBundle{ObjectMeta:metav1.ObjectMeta{Name:"hairem",UID:"uid",Generation:1},Spec:fabricv1alpha1.TenantBundleSpec{TenantID:"TEN00001",HumanAccess:&fabricv1alpha1.TenantHumanAccessSpec{Web:&fabricv1alpha1.HumanWebAccessSpec{IAMGroups:[]string{"client0"},Client0BootstrapGroupRef:"client0"}}},Status:fabricv1alpha1.TenantBundleStatus{ObservedGeneration:1}}
 tuple:=client0VerifiedTuple{Issuer:"issuer",Audience:"aud",Subject:"sub",AuthentikUserUUID:"uuid"};m:=authentik.GroupMembership{Name:"client0",AuthentikGroupUUID:"pin",ActiveAuthentikUserUUIDs:[]string{"uuid"}}
 if _,err:=client0EligibilityFromCanonicalReadSet(b,tuple,"user",map[string]string{"client0":"pin"},m,m);err!=nil{t.Fatal(err)}
 for _,x:=range []struct{b *fabricv1alpha1.TenantBundle;p map[string]string;a,c authentik.GroupMembership;u string}{{b,nil,m,m,"user"},{b,map[string]string{"client0":"wrong"},m,m,"user"},{b,map[string]string{"client0":"pin"},m,authentik.GroupMembership{Name:"client0",AuthentikGroupUUID:"pin"},"user"},{b,map[string]string{"client0":"pin"},m,m,""}}{if _,err:=client0EligibilityFromCanonicalReadSet(x.b,tuple,x.u,x.p,x.a,x.c);err==nil{t.Fatal("expected denial")}}
}
