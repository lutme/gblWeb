# Deployment & Builds

This chapter covers a deployment constraint unique to GBL: **binding by name requires the source code to be readable at runtime**. Understand it to package images and choose build flags correctly.

## Why the source is needed

Go reflection keeps parameter types, not parameter names. At startup GBL parses the handler's source file (AST) and recovers parameter names by the function's **source position** (the entry line reported at runtime) — closures resolve correctly down to the innermost function literal.

This means: the source paths recorded at compile time must still be readable at runtime.

## Builds that break it

| Build style | Consequence |
|---|---|
| `go build -trimpath` | source paths trimmed away, unreadable at runtime → handlers bound by name **fail at startup** |
| Docker multi-stage image copying only the binary | source absent from the final image → same |
| bare binary shipped to a machine without source | same |

The failure is an explicit **startup** error (fail-fast), never a silent mis-binding at request time:

```text
gbl: handler for GET /user/:id binds parameters by name, but the parameter
names are unavailable at runtime (source not readable, e.g. built with
-trimpath or shipped as a bare binary). Rebuild without -trimpath, or bind
through a struct / *struct parameter whose field names come from reflection
```

## What is unaffected

- **A lone struct / pointer-to-struct parameter**: field names come from reflection, no source needed. Such handlers work under any build style;
- handlers declaring only injected parameters (`*Context`, `*http.Request`, `http.ResponseWriter`): no names involved;
- when name recovery fails but the handler needs no names: startup proceeds, with a single Warn logged.

## Three solutions

### Solution 1: keep the source paths (most direct)

Skip `-trimpath`; in multi-stage images copy the source along the compile-time path structure:

```dockerfile
FROM golang:1.27 AS build
WORKDIR /src
COPY . .
RUN go build -o /app/server .

FROM golang:1.27
WORKDIR /src
COPY --from=build /src /src          # source kept at the compile-time path
COPY --from=build /app/server /app/server
CMD ["/app/server"]
```

### Solution 2: struct parameters (cleanest)

Collect the scalars that need name binding into a struct — field names come from reflection, independent of source:

```go
// Depends on parameter names: needs source
gbl.Get("/search", func(keyword string, limit int) string { ... })

// Self-describing: works under any build style
type SearchQuery struct {
    Keyword string
    Limit   int
}
gbl.Get("/search", func(q SearchQuery) string { ... })
```

> Note: with multiple business parameters, the JSON body is split into top-level members keyed by parameter name — still name-dependent; a lone struct parameter decodes the whole body and is fully self-describing.

### Solution 3: mix

Use struct binding for deployment-sensitive endpoints; keep scalar signatures for development-time tooling endpoints.

## TLS

HTTPS is enabled when `application.ini` provides both `certFile` and `keyFile`:

```ini
[gbl]
port     = 443
certFile = /etc/tls/server.crt
keyFile  = /etc/tls/server.key
```

Only one of them does nothing. Certificate paths resolve relative to the working directory; absolute paths are recommended in containers.

## Container checklist

- **Signals**: `Run` handles SIGTERM graceful shutdown (5-second window); set Kubernetes `terminationGracePeriodSeconds` ≥ 10;
- **Port**: the ini `port` or the default 9801 — align with the Service/container port;
- **Logs**: console-only is recommended in containers (configure no file keys), let the collector take stdout; when files are needed, mount a volume for `logDir`;
- **Configuration**: place `application.ini` in the working directory, or mount it there via ConfigMap;
- **Source**: handle the parameter-name constraint with one of the three solutions above.

## Version display

The banner's `version` is read from `debug.ReadBuildInfo()`: builds via `go install github.com/gblgo/gbl@vX.Y.Z` or a tagged dependency show the real version; `go run` / local replace shows `(devel)`. No version constant to maintain in code.

Next: [Performance](/docs/performance).