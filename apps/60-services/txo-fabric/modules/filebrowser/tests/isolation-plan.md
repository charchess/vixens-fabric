# FileBrowser acceptance plan

Before runtime implementation, tests must prove:

1. each scope resolves only its approved logical root;
2. `..`, symlink and absolute-path attempts cannot escape the root;
3. user and agent scopes cannot enumerate tenant/shared/admin material;
4. read-only scopes reject upload, rename, write and delete;
5. every mutating action records non-sensitive audit metadata;
6. revocation prevents new listing, download and mutation requests.
