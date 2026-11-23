package controller

import (
	"strings"
	"time"

	fabricv1alpha1 "github.com/charchess/vixens/apps/60-services/txo-fabric/operator/api/v1alpha1"
)

// CanonicalBrowserTenantAuthority is an internal, read-only authority record.
// Every field is deliberately excluded from JSON: public BrowserTenant/catalog
// transport remains unchanged until a separate transport contract is qualified.
type CanonicalBrowserTenantAuthority struct {
	TenantKey          string `json:"-"`
	FabricTenantID     string `json:"-"`
	TenantBundleUID    string `json:"-"`
	OIDCIssuer         string `json:"-"`
	OIDCClientID       string `json:"-"`
	ObservedGeneration int64  `json:"-"`
}

// resolveCanonicalBrowserTenantAuthority derives a closed authority record
// solely from a currently observed TenantBundle. It performs no transport,
// persistence, credential, provider, or runtime operation.
func resolveCanonicalBrowserTenantAuthority(bundle *fabricv1alpha1.TenantBundle, now time.Time) (CanonicalBrowserTenantAuthority, error) {
	if !browserTenantCurrent(bundle, now) || bundle.Spec.HumanAccess == nil || bundle.Spec.HumanAccess.Web == nil {
		return CanonicalBrowserTenantAuthority{}, errBrowserAuthorityUnavailable
	}
	issuer := bundle.Spec.HumanAccess.Web.OIDC.Issuer
	clientID := bundle.Spec.HumanAccess.Web.OIDC.ClientID
	if !canonicalBrowserTenantText(string(bundle.UID), 253) || !canonicalBrowserTenantText(issuer, 2048) || !canonicalBrowserTenantText(clientID, 253) {
		return CanonicalBrowserTenantAuthority{}, errBrowserAuthorityUnavailable
	}
	return CanonicalBrowserTenantAuthority{
		TenantKey: bundle.Name, FabricTenantID: bundle.Spec.TenantID,
		TenantBundleUID: string(bundle.UID), OIDCIssuer: issuer,
		OIDCClientID: clientID, ObservedGeneration: bundle.Generation,
	}, nil
}

func canonicalBrowserTenantText(value string, max int) bool {
	return value != "" && len(value) <= max && strings.TrimSpace(value) == value && !strings.ContainsAny(value, "\r\n\x00")
}
