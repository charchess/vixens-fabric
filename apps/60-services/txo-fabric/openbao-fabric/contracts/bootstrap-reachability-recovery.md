# OpenBao Fabric bootstrap reachability recovery

source-only recovery contract. The existing `openbao-fabric` ClusterIP Service
publishes not-ready addresses at sync wave -3 without changing identity,
namespace, selectors, api port 8200, targetPort `api`, or readiness probes.

The existing `openbao-fabric-eso-clients` policy remains wave -4 and permits
only the same-namespace `secret-plane-bootstrap` selector on TCP 8200. The ESO
namespace/pod ingress lane is removed. Thus the policy is ordered before
Service publication and grants no new client.

No workload, RBAC, ServiceAccount, Job, certificate, Store, provider, bridge,
gate, runtime action or credential material is introduced by this contract.

Rollback removes only publishNotReadyAddresses; ESO ingress is never restored implicitly.
