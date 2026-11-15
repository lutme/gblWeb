# Routing

GBL routing is **package-level verb registration**: one verb per call, arguments are `path` + handler. Every registration targets the same package-level engine.

## Verb registration

```go
gbl.Get("/items", listItems)               // GET
gbl.Post("/items", createItem)             // POST (reads body per Content-Type)
gbl.Put("/items/:id", replaceItem)         // PUT (reads body)
gbl.Patch("/items/:id", updateItem)        // PATCH (reads body)
gbl.Delete("/items/:id", deleteItem)       // DELETE (no body, path/query only)
gbl.Head("/items", headItems)              // HEAD (optional, see below)
gbl.Options("/items", myOptions)           // OPTIONS (optional, see below)
```

Registration only queues; the real validation, bind-plan construction and routing-tree insertion all happen at `Run()`.

### Match: one handler, several verbs

```go
// Verb names are case-insensitive; unsupported verbs abort startup
gbl.Match([]string{http.MethodGet, http.MethodPost, http.MethodPut}, "/multi", multiHandler)
gbl.Match([]string{"GET", "DELETE"}, "/multi2", multi2Handler)
```

`Match(methods []string, path string, fn any)` registers `fn` for exactly the listed methods, one routable rule per verb.

## Path syntax

A path is a sequence of `/`-separated segments. Each segment is either a literal or a variable — **the two spellings are equivalent**:

```go
gbl.Get("/user/:id", func(id string) string { return id })   // colon style
gbl.Get("/user/{id}", func(id string) string { return id })  // brace style
```

Syntax rules (violations fail startup, reason logged first):

- the variable marker must be at the **start of a segment** and appear only once: `::`, `{{`, `a:b`, `a{b` are all invalid;
- variable names must not be empty: `/:`, `/{}` are invalid;
- an empty path or a lone `/` cannot be registered;
- leading/trailing whitespace is trimmed, and empty segments from consecutive slashes are skipped (`/a//b` normalizes to `/a/b`).

> A variable matches **exactly one segment**; there is no catch-all wildcard. `/files/:path` matches `/files/a` but not `/files/a/b`. Register more segments for deeper structures.

## Match priority: static first + backtracking

Each HTTP verb owns its own segment-organized routing tree. At every level the matcher **tries the static child first, then the variable child**; a dead-end variable branch backtracks and cleans up recorded path parameters:

```go
gbl.Get("/user/:id", func(id string) string { return "var:" + id })
gbl.Get("/user/new", func() string { return "static" })

// GET /user/new → "static" (static wins)
// GET /user/42  → "var:42"
```

A backtracking example:

```go
gbl.Get("/a/:x/end", func(x string) string { return "x=" + x })
gbl.Get("/a/b/other", func() string { return "other" })

// GET /a/b/other: static b first, hits other ✓
// GET /a/b/end:   static b dead-ends, backtracks to :x, x="b" ✓
```

## Route conflicts: fail at startup

Two kinds of ambiguity are rejected at startup (logged, then panic):

```go
// Duplicate concrete route
gbl.Get("/dup", h1)
gbl.Get("/dup", h2) // ✗ static route already exists

// Structurally equivalent variable routes (same position, different name, identical matching behavior)
gbl.Get("/v/:a", h1)
gbl.Get("/v/:b", h2) // ✗ variable route conflicts
```

Reusing the same variable name at the same position is allowed (the node is shared), as long as no terminal is registered twice.

## Automatic HEAD fallback

Registering `Head` is optional: when a path has **no** HEAD registration, the GET rule for the same path is reused automatically — the handler runs normally, `net/http` discards the body but keeps headers and `Content-Length`:

```go
gbl.Get("/health", func() string { return "ok" })

// HEAD /health → 200 OK, Content-Length: 2, no body
```

## Automatic OPTIONS fallback

When a path has **no** OPTIONS registration, the framework answers automatically with `204 No Content` + an `Allow` header listing the methods that path actually supports; register a handler to take over:

```go
gbl.Post("/items", createItem)

// OPTIONS /items → 204, Allow: POST

gbl.Options("/items", func(w http.ResponseWriter) {
    w.Header().Set("Allow", "POST, OPTIONS")
    w.WriteHeader(http.StatusNoContent)
})
// From now on your handler answers OPTIONS /items
```

## The three answers when nothing matches

| Situation | Answer |
|---|---|
| the path exists under no verb | `404 Not Found` |
| the path exists, but not for this verb | `405 Method Not Allowed` + `Allow` header |
| the verb itself is not implemented (TRACE, CONNECT, custom verbs) | `501 Not Implemented` |

The `Allow` header is computed by probing every verb's routing tree and **counts HEAD in** (whenever GET exists) — consistent with the methods `serveHTTP` actually accepts:

```go
gbl.Get("/res", h)
gbl.Post("/res", h)

// PUT /res → 405, Allow: GET, HEAD, POST
```

## Full example: resource routes

```go
func main() {
    gbl.Get("/articles", listArticles)          // list
    gbl.Get("/articles/:id", getArticle)        // detail (:id bound automatically)
    gbl.Post("/articles", createArticle)        // create (JSON body)
    gbl.Put("/articles/:id", replaceArticle)    // full update
    gbl.Patch("/articles/:id", patchArticle)    // partial update
    gbl.Delete("/articles/:id", deleteArticle)  // delete (no body read)

    // HEAD /articles and OPTIONS /articles fall back automatically, no registration needed
    gbl.Run()
}
```

Next: [Route Groups](/docs/groups) — prefixes and scoped middleware.