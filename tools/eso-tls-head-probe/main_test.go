package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strings"
	"testing"
)

type doFunc func(*http.Request) (*http.Response, error)

func (f doFunc) Do(r *http.Request) (*http.Response, error) { return f(r) }

func TestProbeUsesLiteralDNSAndStrictHeadRequest(t *testing.T) {
	called := false
	err := probe(context.Background(), func(_ context.Context, host string) ([]string, error) {
		called = true
		if host != probeHost {
			t.Fatalf("DNS host = %q", host)
		}
		return []string{"192.0.2.9"}, nil
	}, doFunc(func(req *http.Request) (*http.Response, error) {
		if req.Method != http.MethodHead {
			t.Fatalf("method = %s", req.Method)
		}
		if req.URL.String() != probeURL {
			t.Fatalf("URL = %s", req.URL)
		}
		if req.Header.Get("Authorization") != "" {
			t.Fatal("authorization must be absent")
		}
		return &http.Response{StatusCode: http.StatusOK, Body: http.NoBody}, nil
	}))
	if err != nil {
		t.Fatal(err)
	}
	if !called {
		t.Fatal("literal DNS lookup was not made")
	}
}

func TestProbeRejectsDNSFailuresAndEmptyAnswers(t *testing.T) {
	for _, tc := range []struct {
		name string
		ips  []string
		err  error
	}{
		{"lookup-error", nil, errors.New("nxdomain")},
		{"empty-answer", nil, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := probe(context.Background(), func(context.Context, string) ([]string, error) { return tc.ips, tc.err }, doFunc(func(*http.Request) (*http.Response, error) { t.Fatal("request must not run"); return nil, nil }))
			if err == nil {
				t.Fatal("expected DNS failure")
			}
		})
	}
}

func TestProbeRejectsTransportFailureRedirectAndNonHealthyStatus(t *testing.T) {
	cases := []struct {
		name     string
		response *http.Response
		err      error
	}{
		{"tls-error", nil, errors.New("x509: certificate signed by unknown authority")},
		{"redirect", &http.Response{StatusCode: http.StatusFound, Body: http.NoBody}, nil},
		{"unhealthy", &http.Response{StatusCode: http.StatusServiceUnavailable, Body: http.NoBody}, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := probe(context.Background(), func(context.Context, string) ([]string, error) { return []string{"192.0.2.9"}, nil }, doFunc(func(*http.Request) (*http.Response, error) { return tc.response, tc.err }))
			if err == nil {
				t.Fatal("expected strict failure")
			}
		})
	}
}

func TestClientUsesSystemTrustSNIAndNoRedirects(t *testing.T) {
	client := newSystemTrustClient("192.0.2.9")
	if client.CheckRedirect == nil {
		t.Fatal("redirects must be disabled")
	}
	if err := client.CheckRedirect(nil, nil); err == nil {
		t.Fatal("redirect must fail")
	}
	transport, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("transport type = %T", client.Transport)
	}
	if transport.Proxy != nil {
		t.Fatal("proxy must be disabled")
	}
	if transport.TLSClientConfig != nil {
		t.Fatal("must use system trust and URL-derived SNI")
	}
}

func TestRejectsArgumentsAndSourceHasNoOverridesOrShell(t *testing.T) {
	if err := validateArgs([]string{"probe", "https://other.example"}); err == nil {
		t.Fatal("arguments must be rejected")
	}
	if err := validateArgs([]string{"probe"}); err != nil {
		t.Fatal(err)
	}
	source, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"os.Getenv", "flag.", "os/exec", "Authorization", "http://", "CheckRedirect: nil"} {
		if strings.Contains(string(source), forbidden) {
			t.Fatalf("forbidden source capability: %s", forbidden)
		}
	}
	if strings.Count(string(source), probeURL) != 1 {
		t.Fatal("probe URL must have one literal definition")
	}
}
