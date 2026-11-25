# Errors & Panics

GBL's error policy splits echo rights by **who authored the message**: **developer-authored text reaches the client verbatim** — an explicit abort (the `Abort` family), (if you installed one) your `PanicProcessor`, and the error text returned by `Validate`; **framework-assembled internals never do** — panic causes and binding failures (parameter names, Go type strings, strconv detail) go to the server log only, with a generic `500` / `400` on the wire. Request-parse errors (bad Content-Type, oversize body, empty JSON body) describe the client's own request framing and carry no internal identifiers, so they are echoed.

## What can reach the client

| Source | What the client sees |
|---|---|
| `c.AbortWithStatusString(status, body)` | your status + plain-text body |
| `c.AbortWithStatusJSON(status, body)` | your status + JSON body |
| validation failure (`Validatable`) | 400 + the `Validate` error text verbatim (you wrote the message, so you own what it discloses) |
| request-parse failure (bad Content-Type, oversize body) | 400 / 413 + the reason (the client's own request framing) |
| binding failure (non-object multi-parameter JSON, conversion error) | generic 400 (reflection detail — parameter names, Go types — only in the log); a missing member uses its zero value and is not an error by itself |
| return-value serialization failure | 500 + fixed text `response serialization failed` |
| any other panic | generic 500 `Internal Server Error` (stack goes to the log) |
| a registered `PanicProcessor` | **it renders every recovered value above while the response is uncommitted and not hijacked** |

## The Abort family: explicit aborts

```go
gbl.Get("/admin", func(c *gbl.Context) {
    if !isAdmin(c) {
        c.AbortWithStatusString(http.StatusForbidden, "forbidden") // status+msg really reaches the client
        return
    }
    // ... a bare panic here would be a generic 500, details hidden
})
```

The `Abort` methods must be called inside a handler or middleware that declares `*Context`. Unlike a bare `panic`, their message is **guaranteed** to reach the client. Three variants:

```go
c.Abort()                                           // abort the chain only, write nothing
c.AbortWithStatusString(http.StatusUnauthorized, "unauthorized") // plain-text body + abort the chain
c.AbortWithStatusJSON(http.StatusBadRequest, errBody)            // JSON body + abort the chain
```

## PanicProcessor: take over all rendering

```go
type PanicProcessor func(err any) (any, HttpStatus)
type HttpStatus int
```

`RegisterPanicProcessor(p)` installs your panic renderer on the engine. **While the response is uncommitted and the connection is not hijacked, it renders every recovered value** — explicit aborts *and* real crashes alike. You therefore take full responsibility for "never leak internal errors". Recovery after a body write, a header-only Flush or Hijack bypasses the renderer and only logs unexpected panics. The `HttpStatus` you return is validated: codes outside 100–999 are clamped to 500 — the hook is your code, so the framework never lets the recovery path panic a second time:

```go
gbl.RegisterPanicProcessor(func(err any) (any, gbl.HttpStatus) {
    // Return a uniform, safe envelope; never splice err into the body
    return map[string]any{
        "code":    500,
        "message": "internal error",
    }, gbl.HttpStatus(500)
})
```

The returned body can be any renderable value; rendering rules and Content-Type align automatically:

| Payload type | Body | Content-Type |
|---|---|---|
| `error` | `err.Error()` plain text | text/plain |
| struct / map | JSON | application/json |
| array / slice | JSON | application/json |
| `string` | verbatim | text/plain |
| pointer / interface | recursively unwrapped, then the rules above; nil becomes an empty body | follows the final value |
| scalars | formatted text | text/plain |
| nil | empty body | text/plain |

> Note: `error` goes out as plain text, not JSON — the fields of `errors.New` / `fmt.Errorf` values are all unexported, so reflective serialization would only produce an empty `{}`; the framework takes the message text directly.

## A committed body cannot be rewritten

If the body was already written when the panic happened (the handler injected `http.ResponseWriter` and wrote, or an `Abort` method already wrote the denial), the response cannot be rewritten — the framework only flushes the recorded status code (or the default 200). Unexpected panics are still logged with `error` and the full `stack`, including panics after SSE events were sent; no second HTTP response is attempted. After Hijack, or after a Flush that committed headers without a body, only unexpected panics are logged and `PanicProcessor` is not invoked. This is an inherent HTTP limitation, not gbl-specific behavior.

## How it works internally

- Every request's panic is caught by `recover` and rendered per the table above;
- without a `PanicProcessor`, unexpected panics are logged with structured fields: `error` (the recovered value) + `stack` (the full goroutine stack); after a committed response or Hijack they are logged even when a renderer is installed;
- the framework's own 404/405/413/501 and request-parse failures travel the same panic pipeline (internal `responseAbort` values), so with a `PanicProcessor` registered these answers are produced by your renderer too — account for them when designing your envelope.

## Full example: a uniform error envelope

```go
func main() {
    gbl.RegisterPanicProcessor(func(err any) (any, gbl.HttpStatus) {
        // One envelope for every exit; internal details never escape
        return map[string]any{
            "ok":      false,
            "message": "request failed",
        }, gbl.HttpStatus(500)
    })

    gbl.Get("/boom", func() string {
        panic("database DSN leaked here") // client gets only the envelope; the DSN goes to the log
    })

    gbl.Get("/deny", func(c *gbl.Context) {
        c.AbortWithStatusString(http.StatusForbidden, "forbidden") // also rendered by the processor
    })

    gbl.Run()
}
```

Next: [Validation](/docs/validation).