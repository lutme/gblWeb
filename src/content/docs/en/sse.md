# Server-Sent Events

GBL includes built-in [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) support. Declare a `gbl.SSEWriter` parameter on a GET handler to enter the SSE pipeline; response headers, flushing, heartbeats and disconnect cancellation are managed for you.

## Your first event stream

```go
gbl.Get("/events/:topic", func(s gbl.SSEWriter, topic string) {
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-s.Done():
            return
        case <-ticker.C:
            event := map[string]any{"topic": topic, "at": time.Now()}
            if err := s.Send(event); err != nil {
                return
            }
        }
    }
})
```

A browser can subscribe directly:

```javascript
const events = new EventSource("/events/news")
events.onmessage = (event) => {
    console.log(JSON.parse(event.data))
}
```

`EventSource` uses a standard GET request and cannot set arbitrary custom headers like `fetch`. For authentication, use a controlled cookie or an application-provided token endpoint.

## Route constraints

- `SSEWriter` is valid only on **GET** routes; every other method fails startup;
- an SSE handler **must not return a value**; send every event through `Send`;
- other business parameters bind normally, including path, query and struct values;
- binding and `Validatable` checks finish **before** streaming starts, so failures still return an ordinary `400`;
- an unregistered `HEAD` borrows the same GET route and therefore enters the SSE pipeline, but `net/http` suppresses the body;
- global and group middleware still apply.

## The SSEWriter interface

```go
type SSEWriter interface {
    Send(v any) error
    Done() <-chan struct{}
    OnError(func(error))
    OnComplete(func())
}
```

### Send

`Send` serializes, frames, writes and flushes one event. It returns an error if any stage fails:

- `string` and `[]byte` become data verbatim;
- scalars follow ordinary return-value conversion to text;
- composite values are JSON-encoded;
- `error` sends its message;
- CRLF and bare CR normalize to LF, and multiline content becomes multiple `data:` lines;
- a trailing line break is preserved as a final empty data line.

One `Send` emits one `data` event without `event:`, `id:` or `retry:` fields. Strings are still prefixed with `data:` on every line, so they cannot create those protocol fields directly. Use the [raw ResponseWriter](/docs/response-writer) when you need full control over SSE framing.

### Done

`Done` closes when:

- the client disconnects or the request context is canceled;
- a write, flush or write-deadline operation fails;
- the handler returns normally or a panic unwinds;
- graceful framework shutdown begins.

The handler must `select` this channel to stop its own loop. GBL does not forcibly terminate business goroutines or close databases, tickers and other resources owned by the application.

## Startup and response headers

After binding and validation succeed, GBL:

1. sets `Content-Type: text/event-stream`;
2. sets `Cache-Control: no-cache`;
3. sets a write deadline through `ResponseController` when configured;
4. commits and flushes the response headers;
5. starts the idle heartbeat;
6. invokes the business handler.

The client therefore receives a 200 and streaming headers before the first business event exists.

### What clients see when startup fails

| Failure phase | Client result | Logging and callbacks |
|---|---|---|
| parameter binding or validation | ordinary 400 | normal error logging; the business handler never ran, so it could not register callbacks |
| failure before headers commit | 500 `Internal Server Error` | logs `SSE startup failed`; business callbacks are not invoked |
| failure after headers commit | cannot change to 500; connection terminates | logs `SSE startup failed`; business callbacks are not invoked |

Startup failures happen before the business handler, so `OnError` / `OnComplete` do not replace the HTTP error response.

## Heartbeats and write deadlines

While idle, GBL sends an SSE comment:

```text
: ping

```

Comments keep the connection and intermediary proxies active without triggering the browser's `onmessage`. The heartbeat interval is:

- with a positive `WriteTimeout`: `max(1ns, min(WriteTimeout/2, 15s))`;
- with write timeout disabled or unset: a fixed `15s`.

Every business event and heartbeat renews the write deadline, so `WriteTimeout` limits a **single write**, not the lifetime of the stream. A sink without `SetWriteDeadline` support continues without it; a real deadline-setting error terminates the stream.

## Lifecycle callbacks

### OnError

`OnError` runs once for the first runtime write or flush failure and receives the real error. Without it, the framework still logs the first runtime stream failure once at `ERROR` level.

A client disconnect does not necessarily trigger `OnError`: it normally closes `Done`, after which the handler exits and `OnComplete` runs. If a heartbeat or write observes cancellation first, that may also enter `OnError` as a runtime stream failure. `OnError` covers runtime failures such as writes, flushes and write-deadline setup.

### OnComplete

`OnComplete` runs once after normal return, panic unwinding or stream failure. It does not replace `OnError`: a failed stream may invoke `OnError` first and then `OnComplete`.

```go
gbl.Get("/jobs/:id", func(s gbl.SSEWriter, id string) {
    s.OnError(func(err error) {
        gbl.Warn("job stream failed", "id", id, "error", err)
    })
    s.OnComplete(func() {
        gbl.Info("job stream complete", "id", id)
    })

    if err := sendJobEvents(s, id); err != nil {
        return
    }
})
```

### Registration and concurrency rules

- register at handler entry to avoid missing terminal state;
- registering after termination invokes the callback immediately with retained state;
- each callback runs at most once;
- callbacks may run on the request or heartbeat goroutine and must return promptly;
- do not call `Send` from a callback or start work that accesses a recycled `Context`;
- callback panics are recovered and logged instead of crashing the heartbeat goroutine;
- for asynchronous cleanup, copy only the scalar data you need and manage the goroutine lifetime yourself.

## Graceful shutdown

`Shutdown` cancels all SSE streams before waiting for in-flight requests. A handler observing `Done` can stop sending, clean up and return, allowing shutdown to continue.

```go
gbl.Get("/events", func(s gbl.SSEWriter) {
    for {
        select {
        case <-s.Done():
            return
        default:
            if err := s.Send(time.Now().Format(time.RFC3339)); err != nil {
                return
            }
            time.Sleep(time.Second)
        }
    }
})
```

After shutdown cancellation, `Send` returns the cancellation cause immediately instead of writing. A handler that does not observe `Done` can only be stopped when the `Shutdown` timeout expires.

## Middleware and compression

SSE headers flush immediately and business events are written directly one at a time. `Compress` skips committed or written responses, so it does not turn a long-lived stream into a buffered gzip response.

Access-log middleware runs after `c.Next()` returns, so it measures the **whole stream duration**, not latency to the first event. Record per-event metrics inside your business send loop when needed.

## Frequently asked questions

### Why does the browser receive no first event?

Check whether the handler enters its loop, whether `Send` returns an error, and whether a reverse proxy disables streaming or buffers the response. GBL sends headers and heartbeats; heartbeats not triggering `onmessage` is expected.

### Why does business work continue after Done closes?

`Done` is only a notification. The handler must select it and stop its own tickers, goroutines and external tasks; the framework does not manage business resources.

### Are SSE and WebSocket the same feature?

No. SSE is a one-way text stream over ordinary HTTP; WebSocket is a separate upgraded protocol with bidirectional communication. GBL includes SSE, while WebSocket can be integrated through [Hijack](/docs/response-writer) with an application-selected library.

Next: [File Uploads](/docs/uploads) — multipart binding and three independent limits.
