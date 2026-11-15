# Lifecycle

## The startup sequence of Run()

`gbl.Run()` starts the single engine on the configured address and **blocks** until stopped. The internal order is deliberate:

```text
1. Read the application.ini snapshot (missing = empty config; malformed = fatal)
2. Initialize logging first (destinations are plain strings, cannot fail to parse)
3. Parse the full configuration (invalid values can now be written to the configured log files)
4. generateRoute: validate handlers, build bind plans, recover parameter names,
   freeze middleware chains, insert into routing trees
5. Listen on the port (occupied → failure)
6. Print the startup banner + status table
7. Start serving (ServeTLS when TLS is configured)
```

**Logging starts before the rest of configuration validation** — so even invalid config values, route conflicts and port collisions land in your configured log files, not just stderr.

Every fatal startup error panics, and **the reason is logged through the Logger before the panic** (fail-fast).

## The startup banner

```text
  ┏━╸  ┏┓   ╻
  ┃╺┓  ┣┻┓  ┃      zero-dependency Go web framework
  ┗━┛  ┗━┛  ┗━╸

  version    (devel)
  listening  http://localhost:9801
  tls        disabled
  routes     7

2026/11/15 10:00:00 gbl: INFO started successfully, ready to accept requests
```

- `version` is read from the build info — no version constant to maintain; local builds show `(devel)`;
- `listening` renders `0.0.0.0` / `::` as `localhost`;
- `routes` counts the real routable terminals across all verb trees (a Match on several verbs counts once per verb);
- a Logger implementing `BannerLogger` receives the whole block verbatim; otherwise it arrives as one Info.
- the block is followed by an ordinary Info line: `started successfully, ready to accept requests`, with timestamp and level.

## Graceful shutdown

### Signal-triggered (automatic)

On `SIGINT` (Ctrl+C) or `SIGTERM`: close the listener → give in-flight requests a **5-second** window to finish → exit. Container orchestrators (Kubernetes, docker stop) send exactly SIGTERM — it works out of the box.

### Shutdown(ctx) (explicit)

```go
func Shutdown(ctx context.Context) error
```

Gracefully stops the server started by `Run`, waiting for in-flight requests until `ctx` expires:

```go
// Typical usage: trigger shutdown from another goroutine (e.g. an admin endpoint)
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
if err := gbl.Shutdown(ctx); err != nil {
    log.Fatal(err)
}
```

- Repeatable calls (converged internally via once);
- callable from a goroutine **other than Run's**;
- called before `Run`, it returns `http.ErrServerClosed`;
- closing also closes every log file handle.

> `Run` already handles signal-driven graceful shutdown; use `Shutdown` only when you need to trigger it *explicitly* (health-check kill switches, tests, embedding).

## Startup failure and the logging fallback

All startup, configuration and registration failures are fail-fast: the reason is logged through the engine Logger first, then the process panics — a deployment that dies before serving still leaves the reason in the log, not just a bare stack.

### When the log destination itself is broken

File logging configured but unopenable (bad path, no write permission, full disk): there is no file to write the reason into. GBL falls back along **three paths at once**:

1. restores the **default console logger** and prints one error line stating the reason and the fix;
2. writes a plain-language explanation to **`gbl-start-error.log` beside the running executable** (a location you always know, independent of the startup working directory);
3. panics with the reason and a pointer to that file.

```text
2026-11-13T10:00:00+08:00
gbl: startup aborted - the configured file logging could not be initialized.
Reason: open /var/log/gbl/error.log: permission denied
Fix: check the logFile/logDir/infoLog/warnLog/errorLog value in application.ini;
     the path must exist and be writable. Then restart.
```

Two details:

- The fallback file appears **only** when file logging was configured but could not be opened. File logging never enabled ⇒ no such file; other startup failures (route conflicts, invalid config, port occupied) print only to the console/configured logs.
- Under `go run .` the "executable" is a temporary build artifact, so the fallback file lands in the temporary build directory; running a `go build` binary puts it **beside that binary**.

## Embedding and testing

The engine itself implements `http.Handler`, but only the package-level API is exported. To test your business code, either hit a real port with `httptest`, or unit-test handler functions in isolation — handlers are ordinary functions; business logic is testable without the framework.

Next: [Deployment & Builds](/docs/deployment) — what parameter-name recovery demands from your build.