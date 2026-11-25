# Context 详解

`*Context` 贯穿整条中间件链，当 handler 声明它时会被作为参数注入。它携带请求、匹配到的路径参数，以及一个用于在链路与 handler 之间传递数据的 key/value 袋子。业务响应由 handler 返回值自动序列化写出（状态码 200）；中间件用 `Abort` 系列拒绝请求。

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
| `Set(key, value)` / `Get[T](key) (T, bool)` / `Value[T](key) T` | 请求级取值，泛型方法直接类型化（见[请求级取值](/docs/values)） |
| `Result() any` | handler 返回值的 `any` 形态（`Next()` 之后有效）；首次读取时才装箱 |
| `IsWritten() bool` | 是否调用过 `Write`，包括零长度写入；仅 `WriteHeader` / `Flush` 不算 |
| `StatusCode() int` | 将要/已经发送的状态码（默认 200） |
| `Size() int` | 有效响应体长度；1xx、204、304 为 0 |
| `Aborted() bool` | 链路是否已中断 |
| `Abort()` | 中断链路，不写任何内容 |
| `AbortWithStatusString(status, body)` | 以纯文本 body 拒绝并中断 |
| `AbortWithStatusJSON(status, body)` | 以 JSON body 拒绝并中断 |

### 观察类方法的语义

正常返回值路径要等整条链回溯完才自动提交暂存 body，所以 `c.Next()` 返回点能读到**当前有效**结果；更外层的中间件仍可在之后改写状态。直接 Write、Flush、SSE 和 Hijack 会改变提交时机：

- `StatusCode()`：当前记录或已经发送的状态码；没人设置过就是 200。最外层访问日志在完整回溯后读到最终状态。
- `Size()`：已写出的字节数；还没写出时返回暂存结果的长度。1xx、204、304 为 0；零长度 `Write` 后也为 0。
- `Result()`：handler 的原始返回值。不读它就不产生装箱分配。
- `IsWritten()`：handler（注入的 writer）或 `Abort` 系列调用过 `Write` 时为 true，包括零长度写入；此时框架不会再写暂存结果。仅提交响应头不算。

```go
gbl.Use(func(c *gbl.Context) {
    c.Next()
    // 此刻状态码、大小、返回值都已确定
    metrics.Observe(c.StatusCode(), c.Size())
})
```

### 写响应

正常路径不需要手写响应——handler 的返回值由框架自动序列化（见 [Handler 与参数装配](/docs/handlers)）。Context 上的主动写操作只有 `Abort` 系列：

```go
c.AbortWithStatusString(401, "unauthorized")       // 纯文本拒绝并中断链
c.AbortWithStatusJSON(403, map[string]string{"error": "forbidden"}) // JSON 拒绝并中断链
```

成功响应默认是 200；中间件或 handler 可通过注入的 `http.ResponseWriter` 记录自定义状态码。只设置状态码时，框架仍可能自动写返回值；需要完全控制 body 时直接 `WriteHeader` + `Write`。`AbortWithStatusJSON` 序列化失败是服务端错误：以通用 500 中止，不回显细节。详见[ResponseWriter 进阶](/docs/response-writer)。

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
    uid, _ := c.Get[int64]("uid")
    return loadOrders(uid)
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