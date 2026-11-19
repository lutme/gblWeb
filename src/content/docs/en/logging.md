# Logging

Every internal message (recovered panics, binding failures, access-log lines, startup events) is routed through the engine `Logger`, so the application decides destinations and formats.

## The Logger interface

```go
type Logger interface {
    Info(msg string, keysAndValues ...any)
    Warn(msg string, keysAndValues ...any)
    Error(msg string, keysAndValues ...any)
}
```

`msg` describes the event, followed by alternating keys/values. Structured backends (zap/slog) can consume it directly; the default implementation keeps a plain-text shape.

## The default implementation

Emits `gbl: LEVEL msg k=v` through the standard library `log`:

```text
gbl: INFO access method=GET path=/hello status=200 size=10 duration=123µs
gbl: WARN unbound handler parameters handler=main.main reason=...
gbl: ERROR recovered panic error=... stack=...
```

- On a **real terminal** the level labels are colored: INFO green, WARN yellow, ERROR red;
- redirected to a file/pipe it is plain text — ANSI escapes never leak;
- the Windows console automatically attempts to enable VT processing, falling back to plain text on failure.

## SetLogger and NewStdLogger

```go
gbl.SetLogger(myLogger) // nil is ignored; the framework always keeps a usable logger
```

Don't want to implement the interface, just reuse an existing `*log.Logger` (your own writer/flags/prefix)? Use `NewStdLogger`:

```go
myLogger := log.New(os.Stdout, "app ", log.LstdFlags|log.Lmsgprefix)
gbl.SetLogger(gbl.NewStdLogger(myLogger))
```

### A one-struct adapter for zap

```go
type zapLogger struct{ l *zap.SugaredLogger }

func (z zapLogger) Info(msg string, kv ...any)  { z.l.Infow(msg, kv...) }
func (z zapLogger) Warn(msg string, kv ...any)  { z.l.Warnw(msg, kv...) }
func (z zapLogger) Error(msg string, kv ...any) { z.l.Errorw(msg, kv...) }

gbl.SetLogger(zapLogger{l: zap.NewProduction().Sugar()})
```

### Wiring up slog

```go
type slogLogger struct{ l *slog.Logger }

func (s slogLogger) Info(msg string, kv ...any)  { s.l.Info(msg, kv...) }
func (s slogLogger) Warn(msg string, kv ...any)  { s.l.Warn(msg, kv...) }
func (s slogLogger) Error(msg string, kv ...any) { s.l.Error(msg, kv...) }

gbl.SetLogger(slogLogger{l: slog.Default()})
```

## BannerLogger (optional companion interface)

```go
type BannerLogger interface {
    Banner(block string)
}
```

A Logger that also implements `BannerLogger` receives the startup banner pre-rendered as a multi-line block and can print it verbatim, without timestamps/level labels mangling the ASCII art. A Logger implementing only `Logger` still receives the banner — as an ordinary Info record.

```go
func (l appLogger) Banner(block string) {
    fmt.Println(block) // print the art cleanly, no prefix
}
```

The banner contains the logo and the status table (version / listening / tls / routes), followed by an ordinary Info: `started successfully, ready to accept requests`.

## AccessLog

A ready-made middleware: one line per request (method, path, status, size, duration), emitted through the engine Logger:

```go
gbl.Use(gbl.AccessLog)
```

It reads results in the response phase — after `c.Next()` the status code and size are final. Richer observability (metrics, tracing) is middleware too: implement it yourself with `c.StatusCode()`, `c.Size()` and timing around `c.Next()`; the framework ships no transport dependencies.

## File logging (integration example)

The framework itself prints **only to the console** — it ships no built-in file logging. To write files, install a `Logger` pointed at a file:

```go
f, err := os.OpenFile("app.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
if err != nil {
    log.Fatal(err)
}
gbl.SetLogger(gbl.NewStdLogger(log.New(f, "", log.LstdFlags)))
```

For console + file, use `io.MultiWriter(os.Stdout, f)`. Rotation, per-level files and richer routing belong to a zap/slog adapter — or the future gbl-boot integration layer. The kernel ships no built-in file logging and writes no fallback files.

Next: [CORS](/docs/cors).