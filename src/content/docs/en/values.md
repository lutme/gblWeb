# Request-scoped Values

Middleware stores values with `c.Set`; handlers (or later rings) read them with the generic methods `c.Get[T]` / `c.Value[T]`. This is the **only channel** for middleware to pass data to business code — user IDs parsed from tokens, request IDs, tenant info and the like come from neither path, query nor body, so automatic binding cannot provide them.

## Set / Get

```go
gbl.Use(func(c *gbl.Context) {
    c.Set("uid", int64(7))
    c.Next()
})

gbl.Get("/me", func(c *gbl.Context) string {
    uid, ok := c.Get[int64]("uid") // the framework does the assertion
    if !ok {
        return "anonymous"
    }
    return fmt.Sprintf("user %d", uid)
})
```

- `Set(key string, value any)`: same key overwrites; the bag is created lazily and pooled (`keysPool`), so heavy `Set/Get` use allocates nothing.
- `Get[T](key string) (T, bool)`: typed read — a missing key **or a type mismatch** yields T's zero value + `false`, and the caller decides what to do; safe on a `nil` Context.
- When you do not want to name a type, `Get[any]` reads the stored value as-is.
- The bag is cleared with the pooled Context and **never leaks into the next request**.

## Value: when you do not need ok

```go
name := c.Value[string]("displayName") // missing / wrong type → ""
```

| Method | Signature | On missing key or wrong type |
|---|---|---|
| `Get[T]` | `func (c *Context) Get[T any](key string) (T, bool)` | zero value + `false` |
| `Value[T]` | `func (c *Context) Value[T any](key string) T` | returns the zero value only |

Two details:

- **Why methods now?** Since Go 1.27 methods may carry their own type parameters. The former package-level helpers `gbl.Value[T](c, key)` / `gbl.MustValue[T](c, key)` existed only because methods could not be generic; they are removed — call the methods directly.
- A type mismatch counts as a miss:

```go
c.Set("uid", int64(7))
s, ok := c.Get[string]("uid") // "", false — int64 was stored
v, ok := c.Get[any]("uid")    // int64(7), true — returned as-is
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
    uid := c.Value[int64]("uid")
    return loadProfile(uid)
})

// Use Get when you need to distinguish absence
gbl.Get("/debug", func(c *gbl.Context) string {
    if uid, ok := c.Get[int64]("uid"); ok {
        return fmt.Sprintf("uid=%d", uid)
    }
    return "no uid in context"
})
```

## Usage advice

- Define keys as constants in one place to avoid spelling drift;
- read back the exact type you stored — `Get[T]` / `Value[T]` perform no conversion;
- copy out any data needed across requests or asynchronously (the Context is pooled, see [Context](/docs/context)).

Next: [Errors & Panics](/docs/errors) — every detail of the strict error policy.
