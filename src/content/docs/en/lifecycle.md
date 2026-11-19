# Lifecycle

## The startup sequence of Run()

`gbl.Run()` starts the single engine on the configured address and **blocks** until stopped. The internal order is deliberate:

```text
1. Take the configuration Configure left (defaults included; the kernel reads no file)
2. generateRoute: validate handlers, build bind plans, recover parameter names,
   freeze middleware chains, insert into routing trees
3. Listen on the port (occupied → failure)
4. Assemble the http.Server (timeouts from the configuration; a corsHandler
   wraps it when CORS is configured)
5. Publish the server reference (so a concurrent Shutdown can reach it) and
   install the signal watcher
6. Print the startup banner + status table
7. Start serving (ServeTLS when TLS is configured)
```

The configuration is finalized by `Configure` before `Run` (see [Configuration](/docs/configuration)); registration and configuration errors surface in the generateRoute / listen stages. Every fatal startup error panics, and **the reason is logged through the Logger before the panic** (fail-fast).

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
- called before `Run`, it returns `http.ErrServerClosed`.

> `Run` already handles signal-driven graceful shutdown; use `Shutdown` only when you need to trigger it *explicitly* (health-check kill switches, tests, embedding).

## Startup failure (fail-fast)

All startup, configuration and registration failures are fail-fast: the reason is logged through the engine Logger first, then the process panics — a deployment that dies before serving still leaves the reason in your log sink, not just a bare stack. A busy port, a route conflict and a dangerous CORS policy all take this path.

```text
2026/11/19 10:00:00 gbl: ERROR startup aborted reason=listen tcp :9801: bind: address already in use
```

Logs go to the console by default, or to your sink when a custom `Logger` is installed (see [Logging](/docs/logging)). The kernel writes no fallback files.

## Embedding and testing

The engine itself implements `http.Handler`, but only the package-level API is exported. To test your business code, either hit a real port with `httptest`, or unit-test handler functions in isolation — handlers are ordinary functions; business logic is testable without the framework.

Next: [Deployment & Builds](/docs/deployment) — what parameter-name recovery demands from your build.