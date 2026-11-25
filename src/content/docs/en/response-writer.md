# ResponseWriter Control

When a handler declares an `http.ResponseWriter` parameter, GBL injects an **unexported wrapper**. It still satisfies `http.ResponseWriter` and forwards the usual optional capabilities; you never need to export or construct it.

```go
gbl.Get("/raw", func(w http.ResponseWriter) {
    w.Header().Set("Content-Type", "text/plain; charset=utf-8")
    w.WriteHeader(http.StatusCreated)
    _, _ = w.Write([]byte("created"))
})
```

The wrapper is pooled just like `Context` and is valid only for the current request. Never store it globally, cache it, or capture it in a goroutine that outlives the request.

## Automatic versus manual writeback

Handlers with return values normally have their results written by the framework. These operations take over the response:

- `Write`: writes body bytes, including a zero-length write; automatic return-value writeback stops.
- `Hijack`: connection ownership has moved to the application; the framework writes no further HTTP response.

Calling `WriteHeader` alone does **not** take over the body. A return-value handler still has its result written after the chain unwinds, preserving the status you recorded. Statuses `204`, `304` and `101` suppress automatic body writeback.

`Flush` commits the current status and headers but does not prevent later body writes. A return-value handler may therefore still write its result at the end of the chain after middleware calls `Flush`.

## Content-Type and Flush

For return-value handlers, GBL sets a provisional `Content-Type` **before middleware and business code run**, based on the static return type:

| Static return type | Provisional Content-Type |
|---|---|
| `string`, `[]byte`, bool, numbers, complex values | `text/plain; charset=utf-8` |
| struct, map, array, non-byte slice, pointer to a composite, interface | `application/json; charset=utf-8` |
| pointer to a scalar | `text/plain; charset=utf-8` |

This means middleware or a handler can call `Flush` without committing a missing or wrong type. Once headers are committed, they can no longer change.

If the response is still uncommitted, runtime serialization may refine the type. An interface value that actually contains an `error` becomes plain text; a pointer that is actually nil becomes an empty plain-text body. Middleware may override the provisional type when the runtime type stays the same; the framework does not rewrite the same header unnecessarily.

## Status-code semantics

The wrapper follows `net/http` commit rules and adds the 1xx behavior needed by streaming responses:

- `100`–`199`, except `101`, are forwarded immediately and do not become the final status; a final status may follow;
- `101 Switching Protocols` is final, commits immediately and suppresses automatic body writeback;
- the first `200`–`999` status is recorded; later `WriteHeader` calls are ignored;
- a code outside `100`–`999` panics;
- the first `Write` or `Flush` commits the recorded status, defaulting to `200` when none was recorded.

```go
gbl.Get("/hints", func(w http.ResponseWriter) {
    w.Header().Set("Link", "</app.css>; rel=preload; as=style")
    w.WriteHeader(http.StatusEarlyHints) // 103, sent immediately
    w.Header().Set("Content-Type", "text/plain; charset=utf-8")
    w.WriteHeader(http.StatusOK)
    _, _ = w.Write([]byte("ready"))
})
```

`204 No Content` and `304 Not Modified` cannot carry a body. `Context.Size()` returns 0 for 1xx, 204 and 304; when writing directly to those statuses, the underlying `net/http` writer determines the final error.

## Optional interfaces

The wrapper implements `http.Flusher`, `http.Hijacker` and `http.Pusher`, and provides `FlushError` and `Unwrap`. Actual support depends on the underlying `ResponseWriter`.

| Capability | Usage | When unsupported |
|---|---|---|
| Flush | `http.NewResponseController(w).Flush()` | returns `http.ErrNotSupported` |
| Hijack | `http.NewResponseController(w).Hijack()` | returns `http.ErrNotSupported` |
| HTTP/2 Push | `w.(http.Pusher).Push(...)` | returns `http.ErrNotSupported` |
| Write deadline | `ResponseController.SetWriteDeadline` | returns `http.ErrNotSupported` |

The wrapper satisfies `http.Flusher`, so the type assertion always succeeds; however, `Flush()` is a no-op when the underlying sink does not support it. Prefer `ResponseController` or `FlushError() error` when you need to detect missing capability or real errors.

### ResponseController and Unwrap

`Unwrap() http.ResponseWriter` lets `http.ResponseController` continue looking for capabilities the wrapper does not directly forward, such as `SetWriteDeadline`, `SetReadDeadline` and `EnableFullDuplex`.

```go
gbl.Get("/stream", func(w http.ResponseWriter) {
    controller := http.NewResponseController(w)
    if err := controller.SetWriteDeadline(time.Now().Add(30 * time.Second)); err != nil {
        if errors.Is(err, http.ErrNotSupported) {
            return
        }
        return
    }

    w.Header().Set("Content-Type", "text/plain; charset=utf-8")
    if err := controller.Flush(); err != nil {
        return
    }
    _, _ = w.Write([]byte("connected\n"))
})
```

GBL's built-in [SSE](/docs/sse) already uses `ResponseController` for flushing and write deadlines; ordinary SSE handlers do not need to repeat that setup.

## Hijack

`Hijack` transfers the HTTP connection from the `net/http` serving loop to your application:

```go
gbl.Get("/tunnel", func(w http.ResponseWriter) {
    conn, buffered, err := http.NewResponseController(w).Hijack()
    if err != nil {
        return
    }
    defer conn.Close()

    // Your application now owns the protocol, I/O loops, deadlines and shutdown.
    _, _ = buffered.WriteString("HTTP/1.1 101 Switching Protocols\r\n")
    _, _ = buffered.Flush()
})
```

After a successful hijack:

- the wrapper stops automatic response writes; later `Write` calls return `http.ErrHijacked`;
- the application must close the connection, set deadlines and manage reader/writer goroutines correctly;
- `buffered` may already contain bytes the client sent after the handshake, so do not discard it;
- GBL tracks the connection but does not implement your protocol;
- successful `Shutdown` closes tracked hijacked connections that the application has not closed itself;
- hijacked connections are not waited on by `http.Server.Shutdown`, so the handler must observe `Done` or its own shutdown signal.

The GBL core does not implement the WebSocket protocol. Applications may choose a WebSocket library that performs the upgrade through standard `http.Hijacker`; this adds no dependency to GBL itself.

## Pusher

`http.Pusher` is available only when the underlying server supports HTTP/2 server push. GBL forwards `Push` but ships no static-resource push policy. HTTP/1.x or a writer without Push support returns `http.ErrNotSupported`.

## Interaction with return values and compression

- after a direct `Write`, `Compress` does not touch the body already on the wire;
- after `Flush` commits the response, `Compress` also skips it;
- after only `WriteHeader`, a return-value handler's staged body may still be written by the framework;
- for a fully custom success status and body, direct `WriteHeader` + `Write` is the clearest approach.

Next: [Routing](/docs/routing) — path syntax, match priority and automatic fallbacks.
