# FileBrowser module

**Status:** placeholder; no UI, backend, mount or runtime is enabled.

This module is not a migration of the historical broad FileBrowser deployment.
It will become a Fabric workspace explorer only after an explicit scope is chosen
for each capability: `user`, `tenant`, `agent`, `shared-readonly` or
`platform-admin`.

A filesystem path is not an authorization mechanism. The module must resolve an
approved logical root from principal and scope before any listing or file action.
