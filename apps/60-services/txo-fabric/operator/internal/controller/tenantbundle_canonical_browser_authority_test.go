package controller

import (
	"encoding/json"
	"testing"
	"time"

	fabricv1alpha1 "github.com/charchess/vixens/apps/60-services/txo-fabric/operator/api/v1alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestCanonicalBrowserTenantAuthorityIsCurrentPrivateAndNonSerialized(t *testing.T) {
	now := time.Date(2026, 11, 22, 18, 30, 0, 0, time.UTC)
	bundle := humanIdentityTenant("hairem", "TEN00001", "uid-hairem", "client0")
	bundle.Generation = 7
	bundle.Spec.HumanAccess.Web.OIDC.ClientID = "fabric-webui-hairem"
	r := preparedHumanIdentityReconciler(t, bundle)
	r.AuthorizationNow = func() time.Time { return now }
	markBrowserTenantReady(t, r, bundle, now)

	got, err := resolveCanonicalBrowserTenantAuthority(bundle, now)
	if err != nil {
		t.Fatalf("current TenantBundle did not resolve: %v", err)
	}
	want := CanonicalBrowserTenantAuthority{
		TenantKey: bundle.Name, FabricTenantID: bundle.Spec.TenantID,
		TenantBundleUID: string(bundle.UID), OIDCIssuer: bundle.Spec.HumanAccess.Web.OIDC.Issuer,
		OIDCClientID: bundle.Spec.HumanAccess.Web.OIDC.ClientID, ObservedGeneration: bundle.Generation,
	}
	if got != want {
		t.Fatalf("private canonical authority diverged: got=%#v want=%#v", got, want)
	}
	privateJSON, err := json.Marshal(got)
	if err != nil || string(privateJSON) != "{}" {
		t.Fatalf("private canonical authority serialized: json=%s err=%v", privateJSON, err)
	}

	publicJSON, err := json.Marshal(browserTenant(bundle))
	if err != nil {
		t.Fatal(err)
	}
	var public map[string]string
	if err := json.Unmarshal(publicJSON, &public); err != nil {
		t.Fatal(err)
	}
	if len(public) != 3 || public["tenantKey"] != bundle.Name || public["fabricTenantId"] != bundle.Spec.TenantID || public["displayName"] != bundle.Spec.DisplayName ||
		public["tenantBundleUID"] != "" || public["oidcIssuer"] != "" || public["oidcClientId"] != "" || public["observedGeneration"] != "" {
		t.Fatalf("public BrowserTenant JSON changed: json=%s", publicJSON)
	}
}

func TestCanonicalBrowserTenantAuthorityRefusesAnyIncompleteOrNoncurrentBundle(t *testing.T) {
	now := time.Date(2026, 11, 22, 18, 30, 0, 0, time.UTC)
	bundle := humanIdentityTenant("hairem", "TEN00001", "uid-hairem", "client0")
	bundle.Generation = 7
	bundle.Spec.HumanAccess.Web.OIDC.ClientID = "fabric-webui-hairem"
	r := preparedHumanIdentityReconciler(t, bundle)
	r.AuthorizationNow = func() time.Time { return now }
	markBrowserTenantReady(t, r, bundle, now)

	cases := []struct {
		name   string
		mutate func(*fabricv1alpha1.TenantBundle)
	}{
		{"missing uid", func(b *fabricv1alpha1.TenantBundle) { b.UID = "" }},
		{"stale observed generation", func(b *fabricv1alpha1.TenantBundle) { b.Status.ObservedGeneration = b.Generation - 1 }},
		{"deleting", func(b *fabricv1alpha1.TenantBundle) { x := metav1.NewTime(now); b.DeletionTimestamp = &x }},
		{"missing human access", func(b *fabricv1alpha1.TenantBundle) { b.Spec.HumanAccess = nil }},
		{"blank oidc issuer", func(b *fabricv1alpha1.TenantBundle) { b.Spec.HumanAccess.Web.OIDC.Issuer = "" }},
		{"blank oidc client id", func(b *fabricv1alpha1.TenantBundle) { b.Spec.HumanAccess.Web.OIDC.ClientID = "" }},
		{"missing authorization condition", func(b *fabricv1alpha1.TenantBundle) { b.Status.Conditions = nil }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			candidate := bundle.DeepCopy()
			tc.mutate(candidate)
			if got, err := resolveCanonicalBrowserTenantAuthority(candidate, now); err == nil || got != (CanonicalBrowserTenantAuthority{}) {
				t.Fatalf("invalid canonical tenant resolved: got=%#v err=%v", got, err)
			}
		})
	}
}
