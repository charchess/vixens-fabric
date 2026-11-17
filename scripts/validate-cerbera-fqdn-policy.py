#!/usr/bin/env python3
from pathlib import Path
import yaml
root = Path(__file__).resolve().parents[1]
base = root / "apps/60-services/txo-fabric/openbao-fabric/overlays/prod/secret-plane"
policy = yaml.safe_load((base / "cerbera-test-fqdn-egress.cilium.yaml").read_text())
job = yaml.safe_load((base / "bootstrap-job.yaml").read_text())
assert policy["kind"] == "CiliumNetworkPolicy"
spec = policy["spec"]
assert spec["enableDefaultDeny"] == {"egress": True}
assert len(spec["egress"]) == 2
resolver, fqdn = spec["egress"]
assert resolver["toCIDR"] == ["10.96.0.10/32"]
assert {(p["port"], p["protocol"]) for p in resolver["toPorts"][0]["ports"]} == {("53", "UDP"), ("53", "TCP")}
assert fqdn["toFQDNs"] == [{"matchName": "openbao.truxonline.com"}]
assert {(p["port"], p["protocol"]) for p in fqdn["toPorts"][0]["ports"]} == {("443", "TCP")}
assert "hostAliases" not in job["spec"]["template"]["spec"]
raw = (base / "cerbera-test-fqdn-egress.cilium.yaml").read_text().lower()
for forbidden in ("matchpattern", "openbao2.truxonline.com", "*.truxonline.com", "8200", "proxy", "insecure"):
    assert forbidden not in raw, forbidden
ann = policy["metadata"]["annotations"]
assert ann["vixens.io/cerbera-negative-tests"] == "hostname-neighbor,nxdomain,unexpected-ip-tls"
assert ann["vixens.io/cerbera-expurgated-traces"] == "required-before-go"
print("PASS: static FQDN policy guardrails")
