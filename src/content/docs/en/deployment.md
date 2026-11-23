# Deployment & Builds

Binding by name is GBL's core feel and the only point strongly tied to how you build. The good news: **ordinary production builds work out of the box** — no wrapper command, nothing to install, no code generation, no extra build step.

## Two-level parameter-name recovery

Go reflection keeps parameter types, not parameter names. At startup GBL recovers parameter names from two independent sources, tried in order, matched by the function's **source position** (`<file>:<line>`, the position key the runtime reports):

1. **the handler's own source file (on disk)** — the development path: `go run`, or a plain `go build` executed next to the source tree. When both sources exist, disk wins, so stale DWARF baked into an older binary never shadows your just-edited source;
2. **the binary's own DWARF debug info** — the sourceless production path: multi-stage images, bare-binary distribution. The compiler emits DWARF by default, and `-trimpath` only rewrites the recorded source paths — **it does not strip DWARF**.

Position keys resolve closures and function literals too, and are immune to the merging/renaming of identical literals introduced in Go 1.27.

## Production builds: just build

```bash
# -trimpath does not affect name recovery; no generated files in the image, no extra tools
go build -trimpath -o app ./cmd/api
```

Ship this binary into a container and run it without source: `func(id string)` still binds by name. Your project, repository and final image contain **no generated files** and require **no extra tools**.

## The only caveat: `-ldflags "-w"` / `"-s"`

These two linker flags strip debug information — `-w` disables DWARF, `-s` omits the symbol table and debug info. In a binary built with them (and with no source on disk), GBL cannot read the parameter names, so handlers that bind by name **abort startup outright** (fail-fast: logged, then panic) instead of silently binding to nothing:

```text
gbl: handler for GET /user/:id binds parameters by name, but the parameter
names are unavailable at runtime: no source on disk and no DWARF debug info
in the binary. The binary was likely built with `-ldflags "-w"` or `"-s"`,
which strip DWARF; rebuild without them so gbl can read the names from the
binary, or bind through a struct / *struct parameter whose field names come
from reflection
```

Before stripping, think about what these two flags still buy you today: panic stacks and `pprof` symbolization come from a call table the flags never touch, and "hiding internals" is an illusion — function names and type strings stay in the binary regardless. All that remains is roughly a 30% size cut: a long-running service rarely haggles over a few megabytes, and the cost lands squarely on handlers that bind by name. A GBL app's build script has no reason to carry these flags.

If your deployment environment truly cannot ship debug info, two ways out:

- **drop `-w` / `-s`** and keep DWARF — the recommended fix; the size increase is usually acceptable;
- **bind through a `struct` / `*struct` parameter** — field names come from reflection, not DWARF, and survive any build flag:

```go
// Depends on parameter names: needs source or DWARF
gbl.Get("/search", func(keyword string, limit int) string { ... })

// Self-describing: works under any build flag
type SearchQuery struct {
    Keyword string
    Limit   int
}
gbl.Get("/search", func(q SearchQuery) string { ... })
```

> Note: with multiple business parameters, the JSON body is split into top-level members keyed by parameter name — still name-dependent; a lone struct parameter decodes the whole body and is fully self-describing.

## Unaffected cases

- **a lone struct / pointer-to-struct parameter**: field names come from reflection — fine under any build;
- handlers declaring only injected parameters (`*Context`, `*http.Request`, `http.ResponseWriter`, upload files): never name-dependent;
- when names are unrecoverable but the handler needs none: startup proceeds, falling back to positional placeholders silently (a self-describing binding is name-independent, so a per-handler warning would be noise).

## TLS

Set both `CertFile` and `KeyFile` in `Configure` to enable HTTPS:

```go
gbl.Configure(func(c *gbl.Config) {
    c.Port     = "443"
    c.CertFile = "/etc/tls/server.crt"
    c.KeyFile  = "/etc/tls/server.key"
})
```

One of the two enables nothing. Certificate paths resolve against the **working directory at process start**, not the executable's directory; use absolute paths in containers.

## Container checklist

- **Signals**: `Run` ships SIGTERM graceful shutdown (5-second window); set Kubernetes `terminationGracePeriodSeconds` ≥ 10;
- **Ports**: `Configure`'s `Port` or the default 9801, aligned with the Service/container port;
- **Logging**: console-only by default; collectors scrape stdout; for files point `SetLogger` at a mounted path (see [Logging](/docs/logging));
- **Configuration**: the kernel reads no configuration file — parse env vars/ConfigMaps in your own code, then call `Configure`;
- **Builds**: no `-ldflags "-w"/"-s"` (or switch name-dependent endpoints to struct binding); **source does not need to ship in the image**.

## Version display

The banner's `version` comes from `debug.ReadBuildInfo()`: compiled into your app as a tagged dependency it shows the gbl version your `go.mod` requires; `go run` / a local replace build shows `(devel)`. No version constant to maintain in code.

Next: [Performance](/docs/performance).
