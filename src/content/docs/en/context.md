# Context

`*Context` runs through the entire middleware chain and is injected as a parameter when a handler declares it. It carries the request, the matched path parameters, and a key/value bag for passing data between the chain and the handler. Business responses are serialized automatically from the handler's return value (status 200); middleware rejects requests with the `Abort` family.

## Pooled: valid only within this request

> **`Context` is a pooled, reused object.** The moment a request ends it is cleared and handed to the next request. Therefore:
>
> - never store a `*Context` in a global variable or cache;
> - never capture it in a goroutine / callback that outlives the request — you would read another request's data or zero values, and concurrent access is a data race;
> - for data needed asynchronously or across requests, copy the values you use (e.g. results of `c.PathParam`, `c.Get`) into your own variables or structs before the request ends.
>
> The injected `http.ResponseWriter` is pooled under the same rules — never hold it across requests.

```go
// ✗ Wrong: c has been reused after the request ended
gbl.Get("/bad", func(c *gbl.Context) {
    go func() {
        time.Sleep(time.Second)
        log.Println(c.Request.URL.Path) // reads another request!
    }()
})

// ✓ Correct: copy the values you need first
gbl.Get("/good", func(c *gbl.Context) {
    path := c.Request.URL.Path
    go func() {
        time.Sleep(time.Second)
        log.Println(path)
    }()
})
```

## Exported fields

```go
c.Request // *http.Request — the raw inbound request
```

All other fields are unexported; the response writer is only available by declaring an `http.ResponseWriter` parameter.

## Method reference

| Method | Purpose |
|---|---|
| `Next()` | execute the rest of the chain (the handler at the end) |
| `PathParam(name) string` | read a matched path parameter by name (for middleware; business handlers should bind by name) |
| `Set(key, value)` / `Get[T](key) (T, bool)` / `Value[T](key) T` | request-scoped values, typed generically (see [Request-scoped Values](/docs/values)) |
| `Result() any` | the handler's return value as `any` (valid after `Next()`); boxed only on first read |
| `IsWritten() bool` | whether `Write` was called, including a zero-length write; `WriteHeader` / `Flush` alone do not count |
| `StatusCode() int` | the status to be / already sent (default 200) |
| `Size() int` | effective response body length; 0 for 1xx, 204 and 304 |
| `Aborted() bool` | whether the chain has been aborted |
| `Abort()` | abort the chain, write nothing |
| `AbortWithStatusString(status, body)` | reject with a plain-text body and abort |
| `AbortWithStatusJSON(status, body)` | reject with a JSON body and abort |

### Semantics of the observation methods

On the normal return-value path, the stashed body is committed only after the whole chain unwinds, so `c.Next()`'s return point exposes the **current effective** result; outer middleware may still change the status afterward. Direct Write, Flush, SSE and Hijack change commit timing:

- `StatusCode()`: the currently recorded or already-sent status; 200 if nothing set one. An outermost access log reads the final status after full unwinding.
- `Size()`: bytes already written; before writing, it returns the stashed result's length. It is 0 for 1xx, 204, 304 and after a zero-length `Write`.
- `Result()`: the handler's raw return value. Not reading it means no boxing allocation.
- `IsWritten()`: true once the handler (via an injected writer) or the `Abort` family calls `Write`, including a zero-length write; the framework then never writes the stashed result. Committing headers alone does not count.

```go
gbl.Use(func(c *gbl.Context) {
    c.Next()
    // Status code, size and return value are all final at this point
    metrics.Observe(c.StatusCode(), c.Size())
})
```

### Writing responses

The normal path needs no manual response writing — the handler's return value is serialized automatically (see [Handlers & Parameter Binding](/docs/handlers)). The only active writes on the Context are the `Abort` family:

```go
c.AbortWithStatusString(401, "unauthorized")       // reject with plain text and abort the chain
c.AbortWithStatusJSON(403, map[string]string{"error": "forbidden"}) // reject with JSON and abort
```

Success responses default to 200; middleware or a handler can record a custom status through the injected `http.ResponseWriter`. Setting only the status may still be followed by automatic return-value writeback; use direct `WriteHeader` + `Write` for full body control. An `AbortWithStatusJSON` serialization failure is a server-side error: aborted with a generic 500, no details echoed. See [ResponseWriter Control](/docs/response-writer).

## Scenario examples

### Scenario 1: the current user

Auth is a cross-cutting concern — dozens of endpoints share it, and unauthenticated requests must be intercepted uniformly before reaching handlers — so do it once in a middleware: parse the token into a uid.

```go
gbl.Use(func(c *gbl.Context) {
    uid, ok := parseToken(c.Request.Header.Get("Authorization"))
    if !ok {
        c.AbortWithStatusString(http.StatusUnauthorized, "unauthorized")
        return
    }
    c.Set("uid", uid)
    c.Next()
})

// The handler never touches the token, only the current user.
// uid comes from the token, not path/query/body — automatic binding cannot provide it.
// Context is the only channel from middleware to handler.
gbl.Get("/orders", func(c *gbl.Context) []Order {
    uid, _ := c.Get[int64]("uid")
    return loadOrders(uid)
})
```

### Scenario 2: monitoring

After the handler runs, only the Context can see the stashed return value and the effective status/size; the injected `http.ResponseWriter` can only write, not read these.

```go
gbl.Use(func(c *gbl.Context) {
    c.Next()
    metrics.Observe(c.StatusCode(), c.Size())
    if c.Aborted() {
        log.Printf("request aborted, status %d", c.StatusCode())
    }
})
```

### Scenario 3: middleware reading path parameters

Business handlers just bind by name; middleware has no automatic binding — use `PathParam`:

```go
gbl.Use(func(c *gbl.Context) {
    if id := c.PathParam("id"); id != "" {
        c.Set("resourceID", id)
    }
    c.Next()
})
```

Next: [Request-scoped Values](/docs/values) — `Set/Get` and the generic helpers.