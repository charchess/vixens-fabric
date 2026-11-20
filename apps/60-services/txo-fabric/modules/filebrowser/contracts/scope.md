# FileBrowser scope contract

Every future browser request declares one approved scope:

| Scope | Intended root | Default access |
| --- | --- | --- |
| `user` | one user's private workspace | read/write |
| `tenant` | tenant-owned shared workspace | policy-defined |
| `agent` | one agent's private workspace | policy-defined |
| `shared-readonly` | curated shared material | read-only |
| `platform-admin` | explicitly approved operational material | audited, least privilege |

The implementation must reject scope omission, root traversal, symlink escape,
cross-scope references and actions not granted by the selected scope. Deletion,
upload and write behavior require explicit scope permissions and audit evidence.
