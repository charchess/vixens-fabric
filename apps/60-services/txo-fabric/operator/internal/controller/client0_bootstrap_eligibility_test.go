package controller

import "testing"

func TestEvaluateClient0BootstrapEligibility(t *testing.T) {
	valid := Client0BootstrapEligibilityRequest{TenantKey:"tenant",TenantBundleUID:"uid",Issuer:"issuer",Audience:"audience",Subject:"subject",Client0BootstrapGroupRef:"declared",DeclaredIAMGroups:[]string{"declared"},ReadOnlyMemberships:[]string{"declared"},Generation:1,ObservedGeneration:1,Ready:true}
	out, err := EvaluateClient0BootstrapEligibility(valid)
	if err != nil || !out.Eligible || out.GroupRef != "declared" { t.Fatal("expected eligible read-only tuple") }
	for _, bad := range []Client0BootstrapEligibilityRequest{{}, func() Client0BootstrapEligibilityRequest { x:=valid;x.ReadOnlyMemberships=nil;return x }(), func() Client0BootstrapEligibilityRequest { x:=valid;x.DeclaredIAMGroups=nil;return x }(), func() Client0BootstrapEligibilityRequest { x:=valid;x.ObservedGeneration=0;return x }()} { if _,err:=EvaluateClient0BootstrapEligibility(bad);err==nil { t.Fatal("expected denial") } }
}
