# 请求级取值

中间件用 `c.Set` 存值，handler（或后续环）用泛型方法 `c.Get[T]` / `c.Value[T]` 读取。这是中间件向业务传递数据的**唯一通道**——token 解析出的用户 ID、请求 ID、租户信息等，都不来自 path/query/body，自动绑定给不了。

## Set / Get

```go
gbl.Use(func(c *gbl.Context) {
    c.Set("uid", int64(7))
    c.Next()
})

gbl.Get("/me", func(c *gbl.Context) string {
    uid, ok := c.Get[int64]("uid") // 断言由框架代劳
    if !ok {
        return "anonymous"
    }
    return fmt.Sprintf("user %d", uid)
})
```

- `Set(key string, value any)`：同 key 覆盖；袋子懒创建、池化回收（`keysPool`），高频 `Set/Get` 零分配。
- `Get[T](key string) (T, bool)`：类型化读取——key 不存在**或类型不符**都返回 `T` 的零值 + `false`，由调用方决定怎么处理；`nil` Context 安全。
- 不想指定类型时 `Get[any]` 原样取回存的值。
- 显式存入 nil 时，`Get[any]` 返回 `(nil, true)`，键仍然存在；`Get[string]` 则类型不符，返回 `("", false)`。
- 袋子随 Context 池化清空，**不会泄漏到下一个请求**。

## Value：不需要 ok 时

```go
name := c.Value[string]("displayName") // 缺失/类型不符 → ""
```

| 方法 | 签名 | 缺失或类型不符时 |
|---|---|---|
| `Get[T]` | `func (c *Context) Get[T any](key string) (T, bool)` | 零值 + `false` |
| `Value[T]` | `func (c *Context) Value[T any](key string) T` | 只返回零值 |

两个细节：

- **为什么现在是方法？** Go 1.27 起方法可以携带自己的类型参数。早先的包级助手 `gbl.Value[T](c, key)` / `gbl.MustValue[T](c, key)` 正是因为方法不能泛型才存在的，现已删除——直接用方法。
- 类型不符也是 miss：

```go
c.Set("uid", int64(7))
s, ok := c.Get[string]("uid") // "", false —— 存的是 int64
v, ok := c.Get[any]("uid")    // int64(7), true —— 原样返回
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
    uid := c.Value[int64]("uid")
    return loadProfile(uid)
})

// 需要区分缺失的场景用 Get
gbl.Get("/debug", func(c *gbl.Context) string {
    if uid, ok := c.Get[int64]("uid"); ok {
        return fmt.Sprintf("uid=%d", uid)
    }
    return "no uid in context"
})
```

## 使用建议

- key 用常量集中定义，避免拼写漂移；
- 存进去什么类型，取的时候就按什么类型——`Get[T]` / `Value[T]` 不做任何转换；
- 需要跨请求/异步使用的数据，先拷贝出来（Context 池化，见[Context 详解](/docs/context)）。

下一章：[错误与 panic](/docs/errors)——严格错误策略的全部细节。
