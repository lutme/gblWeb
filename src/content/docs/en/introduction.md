# Introduction

**GBL** (Grand Blue Lore, 伟大蓝色真理) is a **zero-dependency** Go web framework. A complete HTTP server runs on the Go standard library alone — `go.mod` contains nothing but the module declaration, no third-party packages at all.

Its core claim fits in one sentence:

> **Write handler signatures however you like; the framework binds the parameters and serializes the return value for you.**

No more glue code like `r.URL.Query().Get(...)`, `json.NewDecoder(r.Body).Decode(...)` or `strconv.Atoi(...)` — the shape of your business function *is* the shape of your API.

## A minimal example

```go
package main

import "github.com/gblgo/gbl"

func main() {
    gbl.Get("/hello", func() string {
        return "hello, gbl"
    })
    gbl.Run() // listens on :9801 by default
}
```

`GET http://localhost:9801/hello` returns the plain text `hello, gbl`. No engine instance, no router object, no context decoding — registration is all it takes.

## Design philosophy

### The signature is the API

At startup GBL reads every handler's function signature and precomputes a binding plan for each parameter by **type + name**:

- `*gbl.Context`, `*http.Request`, `http.ResponseWriter`, upload file types → injected directly by the framework;
- any other type → bound by parameter name from path parameters, the JSON body, or form/query values;
- the return value → serialized automatically to plain text or JSON based on its type.

```go
// The :id path segment is bound to the parameter named id and converted to int
gbl.Get("/user/:id", func(id int) string {
    return fmt.Sprintf("user %d", id)
})

// The entire JSON body is decoded into User automatically
gbl.Post("/user", func(u User) *User {
    u.Name = strings.ToUpper(u.Name)
    return &u // pointers are serialized to JSON automatically
})
```

### One engine, many entry points

GBL exposes exactly **one** package-level engine. `Get/Post/Use/Group/Run/...` all operate on it, so the rules you register and the server you start are guaranteed to be the same instance — there is no "registered into a second engine" trap. No engine instance is exported; route groups exist only as the `RouteGroup` handle returned by `Group`.

### Strict error policy

Unexpected panics **never echo internal details**: the cause goes to the server-side log, the client only receives a generic `500`. Echo rights are split by **who authored the message** — developer-authored text reaches the client verbatim: an explicit `Abort`, a `PanicProcessor` you registered, and the error text returned by `Validate`; framework-assembled internals (reflection detail from binding failures) go only to the log, with a generic `400` on the wire.

### Fail fast

Route conflicts, invalid path syntax, invalid configuration, unrecoverable parameter names… every registration and configuration error surfaces **at startup**: the reason is logged first, then the process panics. When a deployment dies before serving a single request, the log always contains the reason — not just a bare stack trace.

## Capability overview

| Area | Capabilities |
|---|---|
| Routing | 7 HTTP verbs, `:name` and `{name}` path parameters, static-first matching, automatic HEAD/OPTIONS fallback, route groups |
| Binding | Path/query/form/JSON/multipart bound automatically by type + name; scalars, pointers, slices, arrays, nested structs |
| Middleware | Onion model, `c.Next()` request/response phases, group scope, one-step interception with `Abort` |
| Context | Pooled `Context`, request-scoped key/value, generic method accessors `Get[T]` / `Value[T]` |
| Validation | `Validatable` interface, checked after binding and before the handler |
| Errors | `Abort` / `PanicProcessor` / generic 500 fallback, zero leakage of internal details |
| Logging | Structured `Logger` interface, private colored console, any backend via `SetLogger`, package-level `Info/Warn/Error`, startup banner |
| Configuration | `Configure` in code, TLS, timeouts; the kernel reads no configuration file |
| Uploads | Three independent limits (total body / memory threshold / per file), 413 rejection |
| CORS | Struct-based configuration, preflight handling, credentials + wildcard combination rejected at startup |
| Compression | `Compress` gzip middleware: gated on Accept-Encoding, compressible type and a 1 KB minimum, sets `Vary` automatically |
| Lifecycle | Signal-driven graceful shutdown, explicit `Shutdown`, log-then-panic on startup failure |

## Requirements

- **Go 1.27+** (`go.mod` declares `go 1.27`)
- No third-party dependencies — `go get github.com/gblgo/gbl` is all you need
- Handlers bound by name rely on two-level parameter-name recovery: source on disk or the binary's own DWARF; ordinary builds (including `-trimpath` and images copying only the binary) work as-is — only `-ldflags "-w"/"-s"` stripping debug info is restricted (see [Deployment & Builds](/docs/deployment))

## Where to go next

- Want to run something right now: [Getting Started](/docs/getting-started)
- Want to understand the core mechanism: [Handlers & Parameter Binding](/docs/handlers)
- Looking up a symbol: [API Reference](/docs/api-reference)

## License

MIT © lutme · Repository: [github.com/gblgo/gbl](https://github.com/gblgo/gbl)