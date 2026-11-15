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
| `Match` | `func Match(methods []string, path string, fn any)` | one handler on several verbs, case-insensitive |
| `Group` | `func Group(prefix string) RouteGroup` | create a group with a prefix and scoped middleware |

See [Routing](/docs/routing), [Route Groups](/docs/groups).

## Engine & lifecycle

| Symbol | Signature | Description |
|---|---|---|
| `Run` | `func Run()` | start the single engine and block; signal-driven graceful shutdown |
| `Shutdown` | `func Shutdown(ctx context.Context) error` | explicit graceful shutdown; idempotent, cross-goroutine safe |
| `Use` | `func Use(middleware ...HandlerFunc)` | append global middleware (register before Run) |

See [Lifecycle](/docs/lifecycle), [Middleware](/docs/middleware).

## Context

| Symbol | Description |
|---|---|
| `Context` | request context struct; exported field `Request *http.Request`; pooled, never hold across requests |
| `Context.Next` | execute the rest of the chain |
| `Context.Abort` / `Aborted` | abort the chain / query whether aborted |
| `Context.AbortWithStatus` / `AbortWithStatusJSON` | reject with a status / JSON and abort |
| `Context.PathParam` | read a path parameter by name (for middleware) |
| `Context.Set` / `Get` | request-scoped key/value |
| `Context.JSON` / `String` / `Status` | write a response / record status |
| `Context.Result` / `IsWritten` / `StatusCode` / `Size` | response-phase observation |
| `HandlerFunc` | `type HandlerFunc func(c *Context)`, the middleware type |
| `RouteGroup` | group interface: Use + all verbs + Match, each returning itself for chaining |

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
| `Abort` | `func Abort(status int, msg string)` | end the request immediately; status+msg guaranteed to reach the client |
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
| `SetLogger` | `func SetLogger(l Logger)` | install a Logger; nil is ignored |
| `NewStdLogger` | `func NewStdLogger(l *log.Logger) Logger` | standard-library logger adapter |
| `AccessLog` | `func AccessLog(c *Context)` | ready-made access-log middleware |

See [Logging](/docs/logging).

## CORS

| Symbol | Signature | Description |
|---|---|---|
| `SetCorsConfig` | `func SetCorsConfig(cc *CorsConfig)` | install the cross-origin policy; nil disables; dangerous combinations blocked at startup |
| `CorsConfig` | struct (6 exported fields) | AllowedOrigins/Methods/Headers, ExposedHeaders, AllowCredentials, MaxAge |

See [CORS](/docs/cors).

## Configuration

| Symbol | Signature | Description |
|---|---|---|
| `ReadIni` | `func ReadIni(path string) (map[string]map[string]string, error)` | parse any INI file |
| `IniBySection` | `func IniBySection(section string) (map[string]string, bool)` | read a whole section of the application.ini snapshot (a copy) |
| `IniBySectionAndKey` | `func IniBySectionAndKey(section, key string) (string, bool)` | read a single value from the snapshot |

See [Configuration](/docs/configuration).

## Defaults at a glance

| Item | Default |
|---|---|
| port | 9801 |
| application name | gbl |
| readTimeout / readHeaderTimeout / writeTimeout / idleTimeout | 10s / 5s / 10s / 60s |
| total body / memory threshold / per file | 5 MiB / 2 MiB / 1 MiB |
| signal shutdown window | 5s |
| TLS | off (enabled only when certFile+keyFile are both present) |
| CORS | off |
| file logging | off (console only) |