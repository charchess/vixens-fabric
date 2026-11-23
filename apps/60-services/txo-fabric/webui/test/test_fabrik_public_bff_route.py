import unittest
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[5]
INGRESS = ROOT / "apps/60-services/txo-fabric/webui/runtime/ingress.yaml"

class FabrikPublicBffRouteTests(unittest.TestCase):
    def test_fabrik_hostname_is_public_tls_route_to_existing_bff_only(self):
        doc = yaml.safe_load(INGRESS.read_text(encoding="utf-8"))
        self.assertEqual(doc["kind"], "Ingress")
        self.assertEqual(doc["metadata"]["name"], "txo-fabric-webui-bff")
        self.assertEqual(doc["metadata"]["annotations"], {"cert-manager.io/cluster-issuer": "letsencrypt-prod", "external-dns.alpha.kubernetes.io/public": "true", "external-dns.alpha.kubernetes.io/target": "truxonline.com"})
        expected_rules = [
            {"host": host, "http": {"paths": [{"path": "/", "pathType": "Prefix", "backend": {"service": {"name": "txo-fabric-webui-bff", "port": {"number": 3000}}}}]}}
            for host in ("fabric.truxonline.com", "fabrik.truxonline.com")
        ]
        self.assertEqual(doc["spec"]["rules"], expected_rules)
        self.assertEqual(doc["spec"]["tls"], [{"hosts": ["fabric.truxonline.com", "fabrik.truxonline.com"], "secretName": "txo-fabric-webui-bff-tls"}])
        self.assertEqual(doc["spec"]["ingressClassName"], "traefik")

if __name__ == "__main__":
    unittest.main()
