# Context

`*Context` runs through the entire middleware chain and is injected as a parameter when a handler declares it. It carries the request, the matched path parameters, and a key/value bag for passing data between the chain and the handler. Business responses are serialized automatically from the handler's return value; middleware records status with `c.Status` and rejects requests with the `Abort` family.

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
| `Set(key, value)` / `Get(key) (any, bool)` | request-scoped values (typed convenience: `Value` / `MustValue`, see [Request-scoped Values](/docs/values)) |
| `Status(code)` | record the response status (flushed to the wire only on first write) |
| `Result() any` | the handler's return value as `any` (valid after `Next()`); boxed only on first read |
| `IsWritten() bool` | whether the body has been committed |
| `StatusCode() int` | the status to be / already sent (default 200) |
| `Size() int` | effective response body length |
| `Aborted() bool` | whether the chain has been aborted |
| `Abort()` | abort the chain, write nothing |
| `AbortWithStatusString(status, body)` | reject with a plain-text body and abort |
| `AbortWithStatusJSON(status, body)` | reject with a JSON body and abort |

### Semantics of the observation methods

The stashed body is committed only after the whole chain unwinds, so at the point `c.Next()` returns you can already read the **final** results:

- `StatusCode()`: the recorded status; 200 if nobody recorded one. Middleware calling `c.Status(201)` before `Next()` makes the final response 201.
- `Size()`: bytes already written; before writing, it returns the stashed result's length — matching what the client will actually receive.
- `Result()`: the handler's raw return value. Not reading it means no boxing allocation.
- `IsWritten()`: true once the handler (via an injected writer) or the `Abort` family has written a body; the framework then never writes the stashed result.

```go
gbl.Use(func(c *gbl.Context) {
    c.Next()
    // Status code, size and return value are all final at this point
    metrics.Observe(c.StatusCode(), c.Size())
})
```

### Writing responses

The normal path needs no manual response writing — the handler's return value is serialized automatically (see [Handlers & Parameter Binding](/docs/handlers)). The Context offers only two kinds of write:

```go
c.Status(http.StatusAccepted)                      // record status only; the framework still writes the body
c.AbortWithStatusString(401, "unauthorized")       // reject with plain text and abort the chain
c.AbortWithStatusJSON(403, map[string]string{"error": "forbidden"}) // reject with JSON and abort
```

`Status` matches `net/http` — flushed to the wire on first write, and recorded only once. An `AbortWithStatusJSON` serialization failure is a server-side error: aborted with a generic 500, no details echoed. For full control of the response, declare an `http.ResponseWriter` parameter in the handler.

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
    v, _ := c.Get("uid")
    return loadOrders(v.(int64))
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