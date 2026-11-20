# LLMWiki acceptance plan

Before runtime implementation, tests must prove:

1. search, backlinks, graph and previews never disclose another user's document;
2. a document path, link or prior search result cannot escape its logical root;
3. derived indexes are deleted or inaccessible after revocation;
4. editing is rejected without the same authorization required for reading;
5. imported historical Markdown retains owner and provenance metadata.
