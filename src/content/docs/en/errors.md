# Errors & Panics

GBL's error policy is deliberately strict: **unexpected panics never echo internal details** (the cause goes to the log, the client only gets a generic `500`). Exactly two things reach the client verbatim — an explicit `Abort`, and (if you installed one) your `PanicProcessor`.

## What can reach the client

| Source | What the client sees |
|---|---|
| `gbl.Abort(status, msg)` | your status + msg (plain text) |
| `c.AbortWithStatus` / `c.AbortWithStatusJSON` | your status / JSON body |
| binding failure (missing field, conversion error, malformed body) | 400 + the specific reason (the client's own input problem) |
| validation failure (`Validatable`) | generic 400 (details only in the log) |
| return-value serialization failure | 500 + fixed text `response serialization failed` |
| any other panic | generic 500 `Internal Server Error` (stack goes to the log) |
| a registered `PanicProcessor` | **it renders every recovered value above** |

## Abort(status, msg)

```go
gbl.Get("/admin", func(c *gbl.Context) {
    if !isAdmin(c) {
        gbl.Abort(http.StatusForbidden, "forbidden") // status+msg really reaches the client
    }
    // ... a bare panic here would be a generic 500, details hidden
})
```

`Abort` must be called inside a handler or middleware. Unlike a bare `panic`, its message is **guaranteed** to reach the client. The Context also offers variants with status/body:

```go
c.AbortWithStatus(http.StatusUnauthorized)            // no body, status flushed immediately
c.AbortWithStatusJSON(http.StatusBadRequest, errBody) // JSON body + abort the chain
```

## PanicProcessor: take over all rendering

```go
type PanicProcessor func(err any) (any, HttpStatus)
type HttpStatus int
```

`RegisterPanicProcessor(p)` installs your panic renderer on the engine. **Once registered, it renders every recovered value** — explicit aborts *and* real crashes alike. You therefore take full responsibility for "never leak internal errors":

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
| array / slice | JSON | text/plain |
| `string` | verbatim | text/plain |
| pointer / interface | unwrapped one level, then the rules above | follows the unwrapped result |
| scalars | formatted text | text/plain |

> Note: `error` goes out as plain text, not JSON — the fields of `errors.New` / `fmt.Errorf` values are all unexported, so reflective serialization would only produce an empty `{}`; the framework takes the message text directly.

## A committed body cannot be rewritten

If the body was already written when the panic happened (the handler injected `http.ResponseWriter` and wrote, or middleware already called `c.JSON`), the response cannot be rewritten — the framework only flushes the recorded status code (or the default 200). This is an inherent HTTP limitation, not gbl-specific behavior.

## How it works internally

- Every request's panic is caught by `recover` and rendered per the table above;
- unexpected panics are logged with structured fields: `error` (the recovered value) + `stack` (the full goroutine stack), emitted through the engine `Logger` so any backend can index them;
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
        gbl.Abort(http.StatusForbidden, "forbidden") // also rendered by the processor
    })

    gbl.Run()
}
```

Next: [Validation](/docs/validation).