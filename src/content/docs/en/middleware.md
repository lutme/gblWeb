# Middleware

```go
type HandlerFunc func(c *Context)
```

A `HandlerFunc` is one ring of the onion chain. The whole chain is an ordered slice — **engine-level `Use` (outermost) → group `GroupUse` → … → the matched handler (innermost)** — and the `Context` holds a cursor pointing at the current ring.

## The onion model

```text
Request
  │
  ▼
  before A.Next()          ┐
  │                        │ request phase
  ▼                        │ (each Next() call goes one level deeper)
  before B.Next()          ┘
  │
  ▼
  handler                  ── runs business logic, stashes the result
  │
  ▼
  after B.Next()           ┐
  │                        │ response phase
  ▼                        │ (Next() returns level by level, unwinding outward)
  after A.Next()           ┘
  │
  ▼
stashed result written back
  │
  ▼
Response
```

**`c.Next()` executes every ring after the current one** (the remaining middleware, finally the handler), then returns. So the code before `c.Next()` is the **request phase** and the code after it is the **response phase**. Both phases are code you write yourself inside the middleware function, with the `c.Next()` line as the boundary.

The handler is the innermost business function: it has no phases and never calls `Next()`. The normal return-value path waits for the entire chain to unwind before automatic writeback, so timing around `Next()` measures request-processing duration; direct Write, Flush, SSE and Hijack commit earlier. An outermost access log reads the final status after full unwinding.

`Next()` is an ordinary blocking call: it runs all downstream rings synchronously before returning. All nested `Next` calls share one cursor; no ring ever executes twice.

## A runnable ordering example

```go
gbl.Use(func(c *gbl.Context) {
    fmt.Println("engine before")
    c.Next()
    fmt.Println("engine after")
})

api := gbl.Group("/api")
api.GroupUse(func(c *gbl.Context) {
    fmt.Println("group before")
    c.Next()
    fmt.Println("group after")
})
api.Get("/ping", func() string {
    fmt.Println("handler")
    return "pong"
})

// Request GET /api/ping, logs in order:
//   engine before
//   group before
//   handler
//   group after
//   engine after
```

## Aborting the chain: you must use Abort

**To abort the chain you must call an `Abort` method**: it pushes the cursor past the end, skipping every ring that has not started (including the handler).

```go
c.Abort()                                    // abort, write nothing
c.AbortWithStatusString(401, "unauthorized") // reject with a plain-text body
c.AbortWithStatusJSON(403, body)             // reject with a JSON body
```

Two easy traps:

1. **Returning without calling `c.Next()` does NOT abort the chain** — the outer driving loop still advances to the next ring. Only `Abort` stops downstream.

```go
// ✗ Wrong: looks like a block, but the handler still runs
gbl.Use(func(c *gbl.Context) {
    if !allowed(c) { return }
    c.Next()
})

// ✓ Correct
gbl.Use(func(c *gbl.Context) {
    if !allowed(c) {
        c.AbortWithStatusString(http.StatusForbidden, "forbidden")
        return
    }
    c.Next()
})
```

2. **`Abort` only stops downstream.** It does not reach back and interrupt upstream middleware that already called `c.Next()` — those rings still run their post-`Next()` code when they resume. To skip upstream response phases too, write `if c.Aborted() { return }` in the upstream middleware yourself.

## Registration timing

- engine-level `gbl.Use(...)`: merged when chains are assembled at `Run()` — register any time **before `Run()`**;
- group `group.GroupUse(...)`: snapshotted at route registration — **must precede that group's route registrations** (see [Route Groups](/docs/groups));
- chains are frozen into each route at startup; zero assembly cost per request;
- after `Run()` the engine is read-only: calling `Use` / `GroupUse` / any registration method again panics.

`Use` is variadic — install several rings at once:

```go
gbl.Use(recoverer, requestID)
```

## Practical middleware examples

### Request ID + timing

```go
gbl.Use(func(c *gbl.Context) {
    start := time.Now()
    c.Set("requestID", newRequestID())

    c.Next()

    log.Printf("%s %s -> %d (%s)",
        c.Request.Method, c.Request.URL.Path,
        c.StatusCode(), time.Since(start))
})
```

### Auth guard

```go
gbl.Use(func(c *gbl.Context) {
    uid, ok := parseToken(c.Request.Header.Get("Authorization"))
    if !ok {
        c.AbortWithStatusJSON(http.StatusUnauthorized,
            map[string]string{"error": "unauthorized"})
        return
    }
    c.Set("uid", uid)
    c.Next()
})
```

### Reading results in the response phase

After the handler runs, a normal return value is usually still staged — middleware can read the current effective status and return value; direct Write, Flush, SSE or Hijack may already have committed:

```go
gbl.Use(func(c *gbl.Context) {
    c.Next()
    if res, ok := c.Result().(string); ok {
        gbl.Info("handler returned", "len", len(res), "written", c.IsWritten())
    }
})
```

`c.Result()` returns the handler's raw return value (boxed only on first read); `c.IsWritten()` tells whether `Write` was called, including a zero-length write, while `WriteHeader` / `Flush` alone do not count. Middleware has **no API to rewrite the stashed body** — to write a response yourself, use `AbortWithStatusString` / `AbortWithStatusJSON` (they write the body and stop the chain), or declare an `http.ResponseWriter` parameter in the handler for full control.

### Access log (install your own)

The framework ships exactly one ready-made middleware: `gbl.Compress` (gzip response compression, see [Compression](/docs/compression)). No access log is built in; one line is enough:

```go
gbl.Use(func(c *gbl.Context) {
    start := time.Now()
    c.Next()
    gbl.Info("access", "method", c.Request.Method, "path", c.Request.URL.Path,
        "status", c.StatusCode(), "size", c.Size(), "cost", time.Since(start))
})
```

## The complete lifecycle of a request

From arrival to the response reaching the client:

1. **Accept and dispatch.** `net/http` accepts the connection, parses the request and calls the engine; with CORS configured, it is the `corsHandler` wrapping the engine.
2. **CORS (only when configured).** Checks `Origin`: preflights are answered directly; allowed origins get CORS headers; no `Origin` goes straight into the engine.
3. **Method and route matching.** Unknown verb → 501; probe the method's static map first, then enter the dynamic tree and fill path parameters on a miss; unregistered HEAD borrows GET; no match → 404 or 405 + Allow (OPTIONS gets 204).
4. **Build the Context.** Take a `Context` from the pool, load the request, path parameters, this route's frozen chain and the logger.
5. **Execute the chain.** `c.Next()` drives down to the terminal `routeEndpoint`, which calls `invokeHandler()`: parse → bind → validate → invoke the handler via reflection → serialize and stash.
6. **Write the response.** After direct `Write` or Hijack, the application's response stands; the normal return-value path writes back after the chain unwinds, preserving the recorded status (default 200), while 204/304/101 suppress the body. The provisional Content-Type is already set and may still be refined before commit.
7. **Clean up.** Remove multipart temp files; reset the Context, path-parameter map and response writer and return them to their pools.
8. **Any panic** is recovered: while the response is uncommitted and not hijacked, explicit aborts reach the client verbatim, a registered PanicProcessor takes over, and other panics are logged with a generic 500; after commit only unexpected panics are logged and the answer is not rewritten.

Next: [Context](/docs/context) — the single data carrier along the chain.