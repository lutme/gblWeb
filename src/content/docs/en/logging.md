# Logging

Two sources, one sink. Every message the framework produces internally (a recovered panic, a binding failure, a startup abort), and every line business code writes through `gbl.Info` / `gbl.Warn` / `gbl.Error`, flows through the **one** `Logger` installed on the engine — destination, format and coloring are all that sink's decision.

## The Logger interface

```go
type Logger interface {
    Info(msg string, keysAndValues ...any)
    Warn(msg string, keysAndValues ...any)
    Error(msg string, keysAndValues ...any)
}
```

`msg` describes the event, followed by alternating key/value pairs. Structured backends (zap/slog) can consume them directly; the default implementation keeps a plain-text form. This interface is the **only integration contract**: implement it, install it, done.

## The default console (a development aid)

Until you call `SetLogger`, framework and business logs print to the console:

```text
2026-11-20 16:12:38 INFO started port=9801
2026-11-20 16:12:39 ERROR recovered panic error=... stack=...
```

- Shape: a standard date/time prefix, then `LEVEL msg key=value ...`;
- on a **real terminal** the level word is tinted — INFO green, WARN yellow, ERROR red; pipes, redirects and CI get plain text with no ANSI escape codes ever leaked; setting the `NO_COLOR` environment variable turns coloring off even on a real terminal;
- on Windows the console VT processing is switched on automatically; if that fails the output stays plain;
- the default sink is a **private** `log.Logger` and never borrows the standard library's global logger: your `log.SetOutput` / `log.SetFlags` calls cannot move or restyle framework lines, and framework logging never captures or tints your own `log.Println` — the two channels are fully isolated. Sending framework logs somewhere else has exactly one path: `SetLogger`.

## Business entry points: Info / Warn / Error

The three package-level functions are the ergonomic entry for business code:

```go
gbl.Get("/user", func(id string) string {
    gbl.Info("user loaded", "id", id) // → whatever Logger the engine currently holds
    return fetch(id)
})
```

Once a logger is injected with `SetLogger`, that is the framework's sink — call the framework API directly and reuse it; no need to keep or fetch any reference yourself. Internal framework events take the same exit, so installing once decides where every log line goes.

## SetLogger

```go
gbl.SetLogger(myLogger) // passing nil is ignored; the framework always keeps a working logger
```

Like every assembling API, it must be called **before `Run`** — the engine is read-only while serving, and calling it after `Run` panics (see [Lifecycle](/docs/lifecycle)). Wiring up zap/slog/zerolog is a thin adapter: forward `msg` and the key/value pairs to your logger instance.

### A one-line zap adapter

```go
type zapLogger struct{ l *zap.SugaredLogger }

func (z zapLogger) Info(msg string, kv ...any)  { z.l.Infow(msg, kv...) }
func (z zapLogger) Warn(msg string, kv ...any)  { z.l.Warnw(msg, kv...) }
func (z zapLogger) Error(msg string, kv ...any) { z.l.Errorw(msg, kv...) }

gbl.SetLogger(zapLogger{l: zap.NewProduction().Sugar()})
```

### Wiring slog

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

A Logger that *also* implements `BannerLogger` receives the startup banner pre-rendered as a multi-line block and can print it verbatim, without timestamps or level labels squeezing the ASCII art out of alignment. One that only implements `Logger` still gets the banner, just as an ordinary Info record.

```go
func (l appLogger) Banner(block string) {
    fmt.Println(block) // print the art cleanly, no prefix
}
```

The banner carries the logo and a status table (version / listening / tls / routes), followed by one ordinary Info line: `started successfully, ready to accept requests`. The version is read from the build info embedded in the binary: compiled into your application as a dependency, it shows the tagged gbl version your `go.mod` requires; a local or replaced build shows `(devel)`.

## API monitoring is yours

The framework **deliberately** ships no access-log middleware. Monitoring API traffic is an application concern, and everything a one-line middleware needs is already on the chain — install your own:

```go
gbl.Use(func(c *gbl.Context) {
    start := time.Now()
    c.Next()
    gbl.Info("access", "path", c.Request.URL.Path,
        "status", c.StatusCode(), "size", c.Size(), "cost", time.Since(start))
})
```

It reads results in the response phase — after `c.Next()` the status code and size are settled. Richer observability (metrics, tracing) is middleware too: build it from `c.StatusCode()`, `c.Size()` and a timer around `c.Next()`; the kernel embeds no transport dependencies.

## File logging (integration example)

The framework itself **only prints to the console** — no built-in file logging. To write files, implement the interface over any writer — for example this standard-library `log` version pointed at a file:

```go
type fileLogger struct{ l *log.Logger }

func (s fileLogger) Info(msg string, kv ...any)  { s.emit("INFO", msg, kv) }
func (s fileLogger) Warn(msg string, kv ...any)  { s.emit("WARN", msg, kv) }
func (s fileLogger) Error(msg string, kv ...any) { s.emit("ERROR", msg, kv) }

func (s fileLogger) emit(level, msg string, kv []any) {
    s.l.Printf("%s %s %v", level, msg, kv)
}

f, err := os.OpenFile("app.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
if err != nil {
    log.Fatal(err)
}
gbl.SetLogger(fileLogger{l: log.New(f, "", log.LstdFlags)})
```

For dual console-and-file output, swap the `log.New` writer for `io.MultiWriter(os.Stdout, f)`. Rotation, per-level files and richer routing belong to a zap/slog adapter or the future gbl-boot integration layer — the kernel has no built-in file logging and writes no fallback files.

Next: [CORS](/docs/cors).
