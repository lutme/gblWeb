# 请求级取值

中间件用 `c.Set` 存值，handler（或后续环）用 `c.Get` 读取。这是中间件向业务传递数据的**唯一通道**——token 解析出的用户 ID、请求 ID、租户信息等，都不来自 path/query/body，自动绑定给不了。

## Set / Get

```go
gbl.Use(func(c *gbl.Context) {
    c.Set("uid", int64(7))
    c.Next()
})

gbl.Get("/me", func(c *gbl.Context) string {
    v, ok := c.Get("uid") // any + 是否存在
    if !ok {
        return "anonymous"
    }
    return fmt.Sprintf("user %d", v.(int64)) // 自己断言成存进去的类型
})
```

- `Set(key string, value any)`：同 key 覆盖；袋子懒创建，不用不分配。
- `Get(key string) (any, bool)`：key 不存在返回 `nil, false`；类型断言由调用方负责。
- 袋子随 Context 池化清空，**不会泄漏到下一个请求**。

## 泛型助手：Value / MustValue

免去手动断言：

```go
uid, ok := gbl.Value[int64](c, "uid")           // ok == true, uid == 7
name := gbl.MustValue[string](c, "displayName") // 缺失/类型不符 → ""
```

| 函数 | 签名 | 缺失或类型不符时 |
|---|---|---|
| `Value[T]` | `func Value[T any](c *Context, key string) (T, bool)` | 零值 + `false`，调用方决定怎么处理 |
| `MustValue[T]` | `func MustValue[T any](c *Context, key string) T` | 只返回零值 |

两个细节：

- **为什么是包级函数而不是方法？** Go 的方法不能带类型参数，泛型助手只能做成 `gbl.Value[T](c, key)` 的形式。
- `Value` 对 `nil` Context 安全，返回零值 + false。

```go
// 类型不符也是 miss：存的是 int64，按 string 取 → false
c.Set("uid", int64(7))
s, ok := gbl.Value[string](c, "uid") // "", false
```

## 完整场景：鉴权链路

```go
// 中间件：解析一次，全链路复用
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

// 业务 handler：类型化读取，无断言
gbl.Get("/profile", func(c *gbl.Context) Profile {
    uid := gbl.MustValue[int64](c, "uid")
    return loadProfile(uid)
})

// 需要区分缺失的场景用 Value
gbl.Get("/debug", func(c *gbl.Context) string {
    if uid, ok := gbl.Value[int64](c, "uid"); ok {
        return fmt.Sprintf("uid=%d", uid)
    }
    return "no uid in context"
})
```

## 使用建议

- key 用常量集中定义，避免拼写漂移；
- 存进去什么类型，取的时候就按什么类型——`Value` 不做任何转换；
- 需要跨请求/异步使用的数据，先拷贝出来（Context 池化，见[Context 详解](/docs/context)）。

下一章：[错误与 panic](/docs/errors)——严格错误策略的全部细节。