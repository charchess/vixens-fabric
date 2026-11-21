# Reuse Fabric's reviewed, immutable Go builder; runtime remains shell-free.
FROM ghcr.io/charchess/txo-fabric-go-builder@sha256:7b234d8ecfd110d787d4dd83ac42bfaa933a5fe3d6cde139cac92b3245141e31 AS builder
WORKDIR /src
COPY go.mod ./
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /out/eso-tls-head-probe .

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /out/eso-tls-head-probe /eso-tls-head-probe
USER 65532:65532
ENTRYPOINT ["/eso-tls-head-probe"]
