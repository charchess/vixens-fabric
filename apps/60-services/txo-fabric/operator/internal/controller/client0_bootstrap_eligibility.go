package controller

import "errors"

var errClient0BootstrapIneligible = errors.New("client0 bootstrap ineligible")

type Client0BootstrapEligibilityRequest struct {
	TenantKey string
	TenantBundleUID string
	Issuer string
	Audience string
	Subject string
	Client0BootstrapGroupRef string
	DeclaredIAMGroups []string
	ObservedGeneration int64
	Generation int64
	Ready bool
	ReadOnlyMemberships []string
}

type Client0BootstrapEligibility struct {
	Eligible bool
	TenantKey string
	TenantBundleUID string
	Issuer string
	Audience string
	Subject string
	GroupRef string
}

// EvaluateClient0BootstrapEligibility is a typed read-only policy decision.
// Callers must supply already-observed membership; this function never calls IAM.
func EvaluateClient0BootstrapEligibility(in Client0BootstrapEligibilityRequest) (Client0BootstrapEligibility, error) {
	if in.TenantKey == "" || in.TenantBundleUID == "" || in.Issuer == "" || in.Audience == "" || in.Subject == "" || in.Client0BootstrapGroupRef == "" || !in.Ready || in.Generation < 1 || in.ObservedGeneration != in.Generation { return Client0BootstrapEligibility{}, errClient0BootstrapIneligible }
	declared, member := false, false
	for _, group := range in.DeclaredIAMGroups { if group == in.Client0BootstrapGroupRef { declared = true } }
	for _, group := range in.ReadOnlyMemberships { if group == in.Client0BootstrapGroupRef { member = true } }
	if !declared || !member { return Client0BootstrapEligibility{}, errClient0BootstrapIneligible }
	return Client0BootstrapEligibility{Eligible:true,TenantKey:in.TenantKey,TenantBundleUID:in.TenantBundleUID,Issuer:in.Issuer,Audience:in.Audience,Subject:in.Subject,GroupRef:in.Client0BootstrapGroupRef},nil
}
