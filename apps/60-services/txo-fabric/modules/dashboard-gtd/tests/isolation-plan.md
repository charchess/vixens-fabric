# Dashboard GTD acceptance plan

Before any runtime implementation, automated tests must prove:

1. user A cannot enumerate, read, modify, export or delete user B's records;
2. unauthenticated and revoked sessions fail closed;
3. a tenant switch does not change an immutable record owner;
4. module-disabled users receive no route or capability;
5. deletion/export behavior matches the documented ownership contract.
