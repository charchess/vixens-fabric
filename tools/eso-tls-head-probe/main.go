package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"
)

const (
	probeHost = "openbao.truxonline.com"
	probeURL  = "https://openbao.truxonline.com:443/v1/sys/health"
)

type lookupFunc func(context.Context, string) ([]string, error)

type httpDoer interface {
	Do(*http.Request) (*http.Response, error)
}

func validateArgs(args []string) error {
	if len(args) != 1 {
		return errors.New("this fixed-capability probe accepts no arguments")
	}
	return nil
}

func probe(ctx context.Context, lookup lookupFunc, client httpDoer) error {
	ips, err := lookup(ctx, probeHost)
	if err != nil {
		return fmt.Errorf("resolve fixed probe host: %w", err)
	}
	if len(ips) == 0 || net.ParseIP(ips[0]) == nil {
		return errors.New("fixed probe host has no usable DNS answer")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodHead, probeURL, nil)
	if err != nil {
		return fmt.Errorf("create fixed health request: %w", err)
	}
	response, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("strict HTTPS health request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("health response status %d is not 200", response.StatusCode)
	}
	return nil
}

func newSystemTrustClient(ip string) *http.Client {
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	transport := &http.Transport{
		Proxy: nil,
		DialContext: func(ctx context.Context, network, _ string) (net.Conn, error) {
			return dialer.DialContext(ctx, network, net.JoinHostPort(ip, "443"))
		},
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: 5 * time.Second,
	}
	return &http.Client{
		Transport: transport,
		Timeout:   10 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return errors.New("redirects are forbidden")
		},
	}
}

func main() {
	if err := validateArgs(os.Args); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	ips, err := net.DefaultResolver.LookupHost(ctx, probeHost)
	if err != nil || len(ips) == 0 || net.ParseIP(ips[0]) == nil {
		fmt.Fprintln(os.Stderr, "fixed probe DNS resolution failed")
		os.Exit(1)
	}
	if err := probe(ctx, func(context.Context, string) ([]string, error) { return ips, nil }, newSystemTrustClient(ips[0])); err != nil {
		fmt.Fprintln(os.Stderr, "fixed probe failed")
		os.Exit(1)
	}
	fmt.Println("fixed TLS health probe: PASS")
}
