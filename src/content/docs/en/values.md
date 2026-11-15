# Request-scoped Values

Middleware stores values with `c.Set`; handlers (or later rings) read them with `c.Get`. This is the **only channel** for middleware to pass data to business code — user IDs parsed from tokens, request IDs, tenant info and the like come from neither path, query nor body, so automatic binding cannot provide them.

## Set / Get

```go
gbl.Use(func(c *gbl.Context) {
    c.Set("uid", int64(7))
    c.Next()
})

gbl.Get("/me", func(c *gbl.Context) string {
    v, ok := c.Get("uid") // any + presence
    if !ok {
        return "anonymous"
    }
    return fmt.Sprintf("user %d", v.(int64)) // assert to the type you stored
})
```

- `Set(key string, value any)`: same key overwrites; the bag is created lazily — no allocation if unused.
- `Get(key string) (any, bool)`: a missing key returns `nil, false`; the type assertion is the caller's job.
- The bag is cleared with the pooled Context and **never leaks into the next request**.

## Generic helpers: Value / MustValue

Skip the manual assertion:

```go
uid, ok := gbl.Value[int64](c, "uid")           // ok == true, uid == 7
name := gbl.MustValue[string](c, "displayName") // missing / wrong type → ""
```

| Function | Signature | On missing key or wrong type |
|---|---|---|
| `Value[T]` | `func Value[T any](c *Context, key string) (T, bool)` | zero value + `false`; the caller decides what to do |
| `MustValue[T]` | `func MustValue[T any](c *Context, key string) T` | returns the zero value only |

Two details:

- **Why package-level functions instead of methods?** Go methods cannot have type parameters, so the generic helpers must take the form `gbl.Value[T](c, key)`.
- `Value` is safe on a `nil` Context: zero value + false.

```go
// A type mismatch is also a miss: stored int64, read as string → false
c.Set("uid", int64(7))
s, ok := gbl.Value[string](c, "uid") // "", false
```

## Full scenario: an auth pipeline

```go
// Middleware: parse once, reuse along the whole chain
gbl.Use(func(c *gbl.Context) {
    token := strings.TrimPrefix(c.Request.Header.Get("Authorization"), "Bearer ")
    claims, err := verifyJWT(token)
    if err != nil {
        c.AbortWithStatusJSON(http.StatusUnauthorized,
            map[string]string{"error": "invalid token"})
        return
    }
    c.Set("uid", claims.UserID)
    c.Set("role", claims.Role)
    c.Next()
})

// Business handler: typed reads, no assertions
gbl.Get("/profile", func(c *gbl.Context) Profile {
    uid := gbl.MustValue[int64](c, "uid")
    return loadProfile(uid)
})

// Use Value when you need to distinguish absence
gbl.Get("/debug", func(c *gbl.Context) string {
    if uid, ok := gbl.Value[int64](c, "uid"); ok {
        return fmt.Sprintf("uid=%d", uid)
    }
    return "no uid in context"
})
```

## Usage advice

- Define keys as constants in one place to avoid spelling drift;
- read back the exact type you stored — `Value` performs no conversion;
- copy out any data needed across requests or asynchronously (the Context is pooled, see [Context](/docs/context)).

Next: [Errors & Panics](/docs/errors) — every detail of the strict error policy.