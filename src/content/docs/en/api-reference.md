# API Reference

A quick lookup of every exported symbol in GBL. Each symbol's details and examples live in the linked chapter.

## Route registration

| Symbol | Signature | Description |
|---|---|---|
| `Get` | `func Get(path string, fn any)` | register GET; no body read |
| `Head` | `func Head(path string, fn any)` | register HEAD; borrows GET when unregistered |
| `Post` | `func Post(path string, fn any)` | register POST; reads body per Content-Type |
| `Put` | `func Put(path string, fn any)` | register PUT; reads body |
| `Patch` | `func Patch(path string, fn any)` | register PATCH; reads body |
| `Delete` | `func Delete(path string, fn any)` | register DELETE; no body read |
| `Options` | `func Options(path string, fn any)` | register OPTIONS; automatic 204 + Allow when unregistered |
| `Group` | `func Group(prefix string) RouteGroup` | create a group with a prefix and scoped middleware |

See [Routing](/docs/routing), [Route Groups](/docs/groups).

## Engine & lifecycle

| Symbol | Signature | Description |
|---|---|---|
| `Run` | `func Run()` | start the single engine and block; signal-driven graceful shutdown; the engine serves once — a second Run panics |
| `Shutdown` | `func Shutdown(ctx context.Context) error` | explicit graceful shutdown; idempotent, cross-goroutine safe; before Run returns `http.ErrServerClosed` |
| `Use` | `func Use(middleware ...HandlerFunc)` | append global middleware (register before Run) |

> **The engine is read-only after Run.** Every assembling API — route registration, `Use` / `GroupUse`, `SetLogger`, `Configure`, `SetCorsConfig`, `RegisterPanicProcessor`, `SetMax*` — must be called **before** `Run`; calling one afterward panics with an explicit *"must be called before Run"* message instead of being silently swallowed.

See [Lifecycle](/docs/lifecycle), [Middleware](/docs/middleware).

## Context

| Symbol | Description |
|---|---|
| `Context` | request context struct; exported field `Request *http.Request`; pooled, never hold across requests |
| `Context.Next` | execute the rest of the chain |
| `Context.Abort` / `Aborted` | abort the chain / query whether aborted |
| `Context.AbortWithStatusString` / `AbortWithStatusJSON` | reject with plain text / JSON and abort |
| `Context.PathParam` | read a path parameter by name (for middleware) |
| `Context.Set` / `Get` | request-scoped key/value |
| `Context.Result` / `IsWritten` / `StatusCode` / `Size` | response-phase observation |
| `HandlerFunc` | `type HandlerFunc func(c *Context)`, the middleware type |
| `RouteGroup` | group interface: GroupUse + all verbs, each returning itself for chaining |

See [Context](/docs/context).

## Request-scoped values

| Symbol | Signature | Description |
|---|---|---|
| `Value` | `func Value[T any](c *Context, key string) (T, bool)` | typed read; missing/wrong type → zero value + false; nil-safe |
| `MustValue` | `func MustValue[T any](c *Context, key string) T` | same, returning the value only |

See [Request-scoped Values](/docs/values).

## Errors & panics

| Symbol | Signature | Description |
|---|---|---|
| `RegisterPanicProcessor` | `func RegisterPanicProcessor(p PanicProcessor)` | install a panic renderer that takes over rendering of every recovered value |
| `PanicProcessor` | `type PanicProcessor func(err any) (any, HttpStatus)` | the renderer type |
| `HttpStatus` | `type HttpStatus int` | the status type returned by renderers |

See [Errors & Panics](/docs/errors).

## Validation

| Symbol | Signature | Description |
|---|---|---|
| `Validatable` | `interface { Validate() error }` | implemented by a business parameter ⇒ validated automatically (after binding, before the handler) |

See [Validation](/docs/validation).

## Upload limits

| Symbol | Signature | Default | Description |
|---|---|---|---|
| `ByteSize` | `type ByteSize int` | — | named byte-count type |
| `SetMaxBodySize` | `func SetMaxBodySize(size ByteSize)` | 5 MiB | hard cap on the total body, 413 when exceeded |
| `SetMaxFileSize` | `func SetMaxFileSize(size ByteSize)` | 2 MiB | multipart memory threshold (not a cap) |
| `SetMaxUploadFileSize` | `func SetMaxUploadFileSize(size ByteSize)` | 1 MiB | hard cap per file, 413 when exceeded |

See [File Uploads](/docs/uploads).

## Logging

| Symbol | Signature | Description |
|---|---|---|
| `Logger` | `interface { Info/Warn/Error(msg string, kv ...any) }` | the structured logging contract |
| `BannerLogger` | `interface { Banner(block string) }` | optional companion interface, prints the startup banner verbatim |
| `SetLogger` | `func SetLogger(l Logger)` | install a Logger; nil is ignored; call before Run |
| `Info` / `Warn` / `Error` | `func Info(msg string, kv ...any)` etc. | package-level business logging entry, routed through the engine's current Logger |

See [Logging](/docs/logging).

## CORS

| Symbol | Signature | Description |
|---|---|---|
| `SetCorsConfig` | `func SetCorsConfig(cc *CorsConfig)` | install the cross-origin policy; nil disables; dangerous combinations blocked at startup |
| `CorsConfig` | struct (6 exported fields) | AllowedOrigins/Methods/Headers, ExposedHeaders, AllowCredentials, MaxAge |

See [CORS](/docs/cors).

## Compression

| Symbol | Signature | Description |
|---|---|---|
| `Compress` | `func Compress(level int) HandlerFunc` | gzip response-compression middleware; gated on Accept-Encoding, compressible type and a 1 KB minimum |
| `NoCompression` / `BestSpeed` / `DefaultCompression` / `BestCompression` / `HuffmanOnly` | `const` (= the `compress/gzip` values) | compression levels, re-exported — no stdlib import needed |

See [Compression](/docs/compression).

## Configuration

| Symbol | Signature | Description |
|---|---|---|
| `Configure` | `func Configure(fn func(*Config))` | override configuration in code; fn receives the Config pre-filled with defaults; call before Run; nil is a no-op |
| `Config` | struct (8 exported fields) | Name/Port/CertFile/KeyFile + four timeouts; TLS derived from the two paths |

See [Configuration](/docs/configuration).

## Defaults at a glance

| Item | Default |
|---|---|
| port | 9801 |
| application name | gbl |
| readTimeout / readHeaderTimeout / writeTimeout / idleTimeout | 10s / 5s / 10s / 60s |
| total body / memory threshold / per file | 5 MiB / 2 MiB / 1 MiB |
| signal shutdown window | 5s |
| TLS | off (enabled only when CertFile+KeyFile are both present) |
| CORS | off |
| log output | console only (file logging via `SetLogger` integration) |