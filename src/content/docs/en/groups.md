# Route Groups

`Group(prefix string) RouteGroup` returns a registration handle with **a path prefix and group-scoped middleware**. Its methods mirror the package-level verbs one for one — they just prepend the prefix to every path and attach the group's middleware to rules registered through it.

## Basics and chaining

**Every method returns the group itself**, so registrations chain:

```go
api := gbl.Group("/api")

api.
    Get("/ping", func() string { return "pong" }).   // /api/ping
    Post("/ping", func() string { return "posted" }). // /api/ping
    Get("/version", func() string { return "v1" })    // /api/version
```

Prefix and path are concatenated and then run through the same path normalization, so `Group("/api")` + `Get("/ping")` and `Group("/api/")` + `Get("ping")` both yield `/api/ping`.

## The RouteGroup interface

```go
type RouteGroup interface {
    GroupUse(...HandlerFunc) RouteGroup
    Get(string, any) RouteGroup
    Head(string, any) RouteGroup
    Post(string, any) RouteGroup
    Put(string, any) RouteGroup
    Patch(string, any) RouteGroup
    Delete(string, any) RouteGroup
    Options(string, any) RouteGroup
}
```

The group-middleware method is named `GroupUse` — distinct from the engine-level `gbl.Use`, so the two differently-scoped chains are never confused.

## Group middleware: scope isolation

Middleware installed with `group.GroupUse(...)` applies **only to routes registered through that group** — it never leaks to sibling routes and never enters the engine-level `Use` chain:

```go
// Global middleware: runs for every route
gbl.Use(func(c *gbl.Context) {
    log.Println("global")
    c.Next()
})

// Guard dedicated to the admin group
admin := gbl.Group("/admin")
admin.GroupUse(func(c *gbl.Context) {
    if c.Request.URL.Query().Get("token") != "secret" {
        c.AbortWithStatusString(http.StatusUnauthorized, "invalid token")
        return
    }
    c.Next()
})
admin.Get("/stats", func() string { return "stats" }) // global + admin guard

gbl.Get("/public", func() string { return "public" }) // global only

user := gbl.Group("/user")
user.Get("/profile", func() string { return "profile" }) // global only
```

A request to `/admin/stats?token=wrong` → 401; `/public` and `/user/profile` → 200 as usual, because the admin guard is simply not in their chains.

## Critical ordering: GroupUse first, register second

Group middleware is snapshotted into a route **at the moment the route is registered**. This means:

- `group.GroupUse(...)` must happen **before routes are registered through that group**; middleware added later is not appended to already-registered routes;
- engine-level `gbl.Use(...)` behaves differently: it is merged when chains are assembled at `Run()`, so registering any time before `Run()` works, regardless of route-registration order.

```go
api := gbl.Group("/api")

api.GroupUse(authGuard)             // install the guard first
api.Get("/secret", secretHandler)   // ✓ guarded
api.Get("/open", openHandler)       // ✓ also guarded (same group)

api.GroupUse(rateLimit)             // rate limit added later
api.Get("/limited", limitedHandler) // ✓ authGuard + rateLimit
// Note: /secret and /open have authGuard only, no rateLimit
```

> Practical advice: keep all of a group's `GroupUse` calls together, right after creating the group and before any route registration — the clearest semantics.

## Execution order

For a route registered through a group, the chain is:

```text
engine-level Use (outermost) → group GroupUse → routeEndpoint (invokes the business handler)
```

The halves after `c.Next()` unwind **inside-out**. Full mechanics in [Middleware](/docs/middleware).

## Full example: a versioned API

```go
func main() {
    // Global access log: not built in — install a one-line middleware yourself (see "Logging")
    gbl.Use(func(c *gbl.Context) {
        start := time.Now()
        c.Next()
        gbl.Info("access", "path", c.Request.URL.Path,
            "status", c.StatusCode(), "size", c.Size(), "cost", time.Since(start))
    })

    v1 := gbl.Group("/api/v1")
    v1.GroupUse(requireToken)
    v1.
        Get("/users", listUsers).
        Post("/users", createUser).
        Get("/users/:id", getUser).
        Delete("/users/:id", deleteUser)

    v2 := gbl.Group("/api/v2")
    v2.GroupUse(requireToken, rateLimit) // v2 adds a rate-limit layer
    v2.
        Get("/users", listUsersV2).
        Get("/health", healthV2) // HEAD /health reuses GET automatically; no extra registration

    gbl.Run()
}
```

Next: [Middleware](/docs/middleware) — the full execution semantics of the onion model.