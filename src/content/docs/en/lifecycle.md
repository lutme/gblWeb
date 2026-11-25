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

## The engine is read-only after Run

`Run` freezes every assembling-time decision — route registration, `Use` / `GroupUse`, `SetLogger`, `Configure`, CORS, size limits, the panic renderer. Calling one of them after `Run` (or calling `Run` twice) panics with an explicit *"must be called before Run"* message instead of being silently swallowed: a wrong registration **order** is a programming error exactly like a wrong registration **content**, and deserves the same loud treatment. These panics skip the startup log (the process is past startup); the caller's own stack names the mistake.

## The startup banner

```text
  ┏━╸  ┏┓   ╻
  ┃╺┓  ┣┻┓  ┃
  ┗━┛  ┗━┛  ┗━╸

  version    v0.1.0
  listening  http://localhost:9801
  tls        disabled
  routes     7

2026/11/15 10:00:00 INFO started successfully, ready to accept requests
```

- `version` is read from the build info embedded in the binary — no version constant to maintain: compiled into your app as a dependency it shows the tagged gbl version your `go.mod` requires; a local or replaced build shows `(devel)`;
- `listening` renders `0.0.0.0` / `::` as `localhost`;
- `routes` counts the real routable terminals across all verb trees (one handler registered on several verbs counts once per verb);
- a Logger implementing `BannerLogger` receives the whole block verbatim; otherwise it arrives as one Info.
- the block is followed by an ordinary Info line: `started successfully, ready to accept requests`, with timestamp and level.

## Graceful shutdown

GBL shuts down in this order: **cancel SSE streams → close the listener → drain in-flight requests → close still-tracked hijacked connections after success**. `Run` waits for an in-progress shutdown attempt to finish rather than racing it; if that attempt times out and returns an error, `Run` also returns, but remaining connections stay open for the caller to retry or manage.

### Signal-triggered (automatic)

`SIGINT` (Ctrl+C) and `SIGTERM` use a **5-second** drain window. Container orchestrators (Kubernetes, docker stop) send SIGTERM, so this works out of the box.

If the window expires:

1. a WARN records the real error;
2. `http.Server.Close` forcibly closes remaining active connections;
3. still-tracked hijacked connections are closed.

### Shutdown(ctx) (explicit)

```go
func Shutdown(ctx context.Context) error
```

```go
// Trigger from another goroutine; do not call synchronously inside an
// in-flight handler that the shutdown would then wait for.
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
if err := gbl.Shutdown(ctx); err != nil {
    log.Printf("shutdown did not finish: %v", err)
}
```

- the first call cancels every SSE stream, allowing handlers that observe `Done` to clean up and exit;
- `http.Server.Shutdown` closes the listener first, then waits for in-flight requests until `ctx` expires;
- on timeout it returns an error but **does not forcibly close** remaining connections; the listener is already closed, unfinished connections stay alive, and another `Shutdown` call can wait for them;
- only success latches completion; later calls after success are no-ops;
- success closes still-tracked hijacked connections; connections the application closes itself leave the tracking table;
- callable from a goroutine **other than Run's**;
- called before `Run`, it returns `http.ErrServerClosed`.

The key difference is that **explicit `Shutdown` timeout returns an error and preserves remaining connections, while the signal path force-closes after its timeout**. `Run` exits after that call returns and does not keep managing the preserved connections. If you need a forced policy, exit the process or manage your own connections after an explicit timeout.

> `Run` already handles signal-driven graceful shutdown; use `Shutdown` only when you need to trigger it *explicitly* (health-check kill switches, tests, embedding). See [Server-Sent Events](/docs/sse) and [ResponseWriter Control](/docs/response-writer) for stream and hijack details.

## Startup failure (fail-fast)

All startup, configuration and registration failures are fail-fast: the reason is logged through the engine Logger first, then the process panics — a deployment that dies before serving still leaves the reason in your log sink, not just a bare stack. A busy port, a route conflict, a dangerous CORS policy, an unsupported handler shape (method value / generic instantiation, see [Handlers & Binding](/docs/handlers)) and a name-binding handler whose DWARF was stripped by `-ldflags "-w"/"-s"` (see [Deployment & Builds](/docs/deployment)) all take this path.

```text
2026/11/19 10:00:00 ERROR startup aborted reason=listen tcp :9801: bind: address already in use
```

Logs go to the console by default, or to your sink when a custom `Logger` is installed (see [Logging](/docs/logging)). The kernel writes no fallback files.

## Embedding and testing

The engine itself implements `http.Handler`, but only the package-level API is exported. To test your business code, either hit a real port with `httptest`, or unit-test handler functions in isolation — handlers are ordinary functions; business logic is testable without the framework.

Next: [Deployment & Builds](/docs/deployment) — what parameter-name recovery demands from your build.