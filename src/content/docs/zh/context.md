# Context 详解

`*Context` 贯穿整条中间件链，当 handler 声明它时会被作为参数注入。它携带请求、匹配到的路径参数，以及一个用于在链路与 handler 之间传递数据的 key/value 袋子。业务响应由 handler 返回值自动序列化写出；中间件用 `c.Status` 记录状态，用 `Abort` 系列拒绝请求。

## 池化：只在本次请求内有效

> **`Context` 是池化复用的对象。** 请求一结束，它就会被清空并交给下一个请求复用。因此：
>
> - 别把 `*Context` 存进全局变量或缓存；
> - 别在请求结束后才运行的 goroutine / 回调里捕获它——那样读到的是别的请求的数据或零值，并发访问还会造成数据竞争；
> - 需要异步或跨请求使用的数据，请在请求结束前把用到的值（如 `c.PathParam`、`c.Get` 的结果）拷贝进你自己的变量或结构体。
>
> 注入的 `http.ResponseWriter` 同样池化，规则一致，不得跨请求持有。

```go
// ✗ 错误：请求结束后 c 已被复用
gbl.Get("/bad", func(c *gbl.Context) {
    go func() {
        time.Sleep(time.Second)
        log.Println(c.Request.URL.Path) // 读到别的请求！
    }()
})

// ✓ 正确：先拷贝需要的值
gbl.Get("/good", func(c *gbl.Context) {
    path := c.Request.URL.Path
    go func() {
        time.Sleep(time.Second)
        log.Println(path)
    }()
})
```

## 导出字段

```go
c.Request // *http.Request —— 原始入站请求
```

其余字段全部未导出，响应写入器只能通过声明 `http.ResponseWriter` 参数获得。

## 方法参考

| 方法 | 用途 |
|---|---|
| `Next()` | 执行链上剩余部分（到末端即 handler） |
| `PathParam(name) string` | 按名字取匹配到的路径参数（供中间件用；业务 handler 请按名绑定） |
| `Set(key, value)` / `Get(key) (any, bool)` | 请求级取值（类型化便利：`Value` / `MustValue`，见[请求级取值](/docs/values)） |
| `Status(code)` | 记录响应状态（首次写入时才真正落到线上） |
| `Result() any` | handler 返回值的 `any` 形态（`Next()` 之后有效）；首次读取时才装箱 |
| `IsWritten() bool` | body 是否已提交 |
| `StatusCode() int` | 将要/已经发送的状态码（默认 200） |
| `Size() int` | 有效响应体长度 |
| `Aborted() bool` | 链路是否已中断 |
| `Abort()` | 中断链路，不写任何内容 |
| `AbortWithStatusString(status, body)` | 以纯文本 body 拒绝并中断 |
| `AbortWithStatusJSON(status, body)` | 以 JSON body 拒绝并中断 |

### 观察类方法的语义

暂存 body 在整条链回溯完才提交，所以 `c.Next()` 返回点就能读到**最终**结果：

- `StatusCode()`：已记录的状态码；没人记录过就是 200。中间件在 `Next()` 前调 `c.Status(201)`，最终响应就是 201。
- `Size()`：已写出的字节数；还没写出时返回暂存结果的长度——与客户端实际将收到的一致。
- `Result()`：handler 的原始返回值。不读它就不产生装箱分配。
- `IsWritten()`：handler（注入的 writer）或 `Abort` 系列已经写过 body 时为 true，此时框架不会再写暂存结果。

```go
gbl.Use(func(c *gbl.Context) {
    c.Next()
    // 此刻状态码、大小、返回值都已确定
    metrics.Observe(c.StatusCode(), c.Size())
})
```

### 写响应

正常路径不需要手写响应——handler 的返回值由框架自动序列化（见 [Handler 与参数装配](/docs/handlers)）。Context 上只有两类写操作：

```go
c.Status(http.StatusAccepted)                      // 只记录状态，body 仍由框架写
c.AbortWithStatusString(401, "unauthorized")       // 纯文本拒绝并中断链
c.AbortWithStatusJSON(403, map[string]string{"error": "forbidden"}) // JSON 拒绝并中断链
```

`Status` 与 `net/http` 一致——首次写入时才落到线上，且只记录一次。`AbortWithStatusJSON` 序列化失败是服务端错误：以通用 500 中止，不回显细节。想完全接管响应，在 handler 里声明 `http.ResponseWriter` 参数。

## 场景示例

### 场景一：当前登录用户

鉴权是横切逻辑——几十个接口共用，且未登录必须在进 handler 前统一拦下——所以放在一个中间件里做一次：把 token 解析成 uid。

```go
gbl.Use(func(c *gbl.Context) {
    uid, ok := parseToken(c.Request.Header.Get("Authorization"))
    if !ok {
        c.AbortWithStatusString(http.StatusUnauthorized, "unauthorized")
        return
    }
    c.Set("uid", uid)
    c.Next()
})

// handler 不碰 token，只用当前用户。
// uid 来自 token，而非 path/query/body，自动绑定给不了——
// Context 是中间件传给 handler 的唯一通道。
gbl.Get("/orders", func(c *gbl.Context) []Order {
    v, _ := c.Get("uid")
    return loadOrders(v.(int64))
})
```

### 场景二：接口监控

handler 跑完后，只有 Context 能拿到暂存返回值与有效状态/大小；注入的 `http.ResponseWriter` 只能写，读不到这些。

```go
gbl.Use(func(c *gbl.Context) {
    c.Next()
    metrics.Observe(c.StatusCode(), c.Size())
    if c.Aborted() {
        log.Printf("请求被中断，状态码 %d", c.StatusCode())
    }
})
```

### 场景三：中间件读路径参数

业务 handler 按名绑定即可；中间件没有自动绑定，用 `PathParam`：

```go
gbl.Use(func(c *gbl.Context) {
    if id := c.PathParam("id"); id != "" {
        c.Set("resourceID", id)
    }
    c.Next()
})
```

下一章：[请求级取值](/docs/values)——`Set/Get` 与泛型助手。