# 路由分组

`Group(prefix string) RouteGroup` 返回一个**带路径前缀、带分组作用域中间件**的注册句柄。它的方法与包级动词一一对应，只是给每个路径加上前缀、给经它注册的规则附上分组中间件。

## 基本用法与链式调用

**每个方法都返回分组自身**，因此可以链式注册：

```go
api := gbl.Group("/api")

api.
    Get("/ping", func() string { return "pong" }).   // /api/ping
    Post("/ping", func() string { return "posted" }). // /api/ping
    Get("/version", func() string { return "v1" })    // /api/version
```

前缀与路径直接拼接后走统一的路径规范化，所以 `Group("/api")` + `Get("/ping")` 与 `Group("/api/")` + `Get("ping")` 都得到 `/api/ping`。

## RouteGroup 接口

```go
type RouteGroup interface {
    Use(...HandlerFunc) RouteGroup
    Get(string, any) RouteGroup
    Head(string, any) RouteGroup
    Post(string, any) RouteGroup
    Put(string, any) RouteGroup
    Patch(string, any) RouteGroup
    Delete(string, any) RouteGroup
    Options(string, any) RouteGroup
    Match([]string, string, any) RouteGroup
}
```

## 分组中间件：作用域隔离

`group.Use(...)` 装的中间件**只作用于通过该分组注册的路由**，不会泄到同级其他路由，也不会进引擎级 `Use` 链：

```go
// 全局中间件：所有路由都会跑
gbl.Use(func(c *gbl.Context) {
    log.Println("global")
    c.Next()
})

// admin 分组专用守卫
admin := gbl.Group("/admin")
admin.Use(func(c *gbl.Context) {
    if c.Request.URL.Query().Get("token") != "secret" {
        c.AbortWithStatus(http.StatusUnauthorized)
        return
    }
    c.Next()
})
admin.Get("/stats", func() string { return "stats" }) // global + admin 守卫

gbl.Get("/public", func() string { return "public" }) // 只有 global

user := gbl.Group("/user")
user.Get("/profile", func() string { return "profile" }) // 只有 global
```

请求 `/admin/stats?token=wrong` → 401；请求 `/public` 或 `/user/profile` → 照常 200，因为 admin 守卫根本不在它们的链里。

## 关键时序：先 Use，后注册

分组中间件在**路由注册的那一刻**被快照进该路由。这意味着：

- `group.Use(...)` 必须发生在**经该分组注册路由之前**，后装的中间件不会追加到已注册的路由上；
- 引擎级 `gbl.Use(...)` 则不同：它在 `Run()` 组装链时才合并，所以只要在 `Run()` 之前注册即可，与路由注册顺序无关。

```go
api := gbl.Group("/api")

api.Use(authGuard)                  // 先装守卫
api.Get("/secret", secretHandler)   // ✓ 带守卫
api.Get("/open", openHandler)       // ✓ 也带守卫（同组）

api.Use(rateLimit)                  // 后装的限流
api.Get("/limited", limitedHandler) // ✓ 带 authGuard + rateLimit
// 注意：/secret 与 /open 只有 authGuard，没有 rateLimit
```

> 实践建议：把分组的所有 `Use` 集中写在分组创建之后、任何路由注册之前，语义最清晰。

## 执行顺序

一条经过分组注册的路由，其链为：

```text
引擎级 Use（最外） → 分组 Use → routeEndpoint（调用业务 handler）
```

`c.Next()` 之后的半段按**由内向外**回溯。完整机制见[中间件](/docs/middleware)。

## 完整示例：版本化 API

```go
func main() {
    gbl.Use(gbl.AccessLog) // 全局访问日志

    v1 := gbl.Group("/api/v1")
    v1.Use(requireToken)
    v1.
        Get("/users", listUsers).
        Post("/users", createUser).
        Get("/users/:id", getUser).
        Delete("/users/:id", deleteUser)

    v2 := gbl.Group("/api/v2")
    v2.Use(requireToken, rateLimit) // v2 多一层限流
    v2.
        Get("/users", listUsersV2).
        Match([]string{"GET", "HEAD"}, "/health", healthV2)

    gbl.Run()
}
```

下一章：[中间件](/docs/middleware)——洋葱模型的完整执行语义。