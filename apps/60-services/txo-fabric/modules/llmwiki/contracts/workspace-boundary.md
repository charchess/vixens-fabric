# LLMWiki workspace-boundary contract

- A workspace has an explicit owning user principal and explicit logical root.
- Access is authorized per request through Fabric; path knowledge is not access.
- Documents, attachments, previews, search results and derived indexes preserve
  the same ownership boundary.
- Markdown is authoritative until a module-specific ADR approves another model.
- A future editor must define concurrent-editing, versioning, restore and
  import behavior before migration from historical tools.
