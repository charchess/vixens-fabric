package main

import (
	"os"
	"strings"
	"testing"
)

func TestImageIsStaticScratchNonRootAndShellFree(t *testing.T) {
	content, err := os.ReadFile("Dockerfile")
	if err != nil {
		t.Fatal(err)
	}
	text := string(content)
	for _, required := range []string{
		"FROM ghcr.io/charchess/txo-fabric-go-builder@sha256:",
		"FROM scratch",
		"COPY --from=builder /out/eso-tls-head-probe /eso-tls-head-probe",
		"USER 65532:65532",
		"ENTRYPOINT [\"/eso-tls-head-probe\"]",
	} {
		if !strings.Contains(text, required) {
			t.Fatalf("missing image contract: %s", required)
		}
	}
	runtimeStage := text[strings.LastIndex(text, "FROM scratch"):]
	for _, forbidden := range []string{"RUN ", "CMD ", "sh", "bash", "ENV ", "ARG "} {
		if strings.Contains(runtimeStage, forbidden) {
			t.Fatalf("forbidden runtime capability: %s", forbidden)
		}
	}
}
