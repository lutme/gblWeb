# 中间件

```go
type HandlerFunc func(c *Context)
```

`HandlerFunc` 是洋葱链上的一环。整条链是一个有序切片——**引擎级 `Use`（最外）→ 分组 `GroupUse` → … → 匹配到的 handler（最内）**，`Context` 里保存着一个指向当前环的游标。

## 洋葱模型

```text
请求
  │
  ▼
  A.Next() 之前            ┐
  │                        │ 请求阶段
  ▼                        │ （每调一次 Next() 深入一层）
  B.Next() 之前            ┘
  │
  ▼
  handler                  ── 执行业务，暂存结果
  │
  ▼
  B.Next() 之后            ┐
  │                        │ 响应阶段
  ▼                        │ （Next() 逐层返回，向外回溯）
  A.Next() 之后            ┘
  │
  ▼
写回暂存结果
  │
  ▼
响应
```

**`c.Next()` 会执行当前环之后的所有环**（剩余中间件，最后是 handler），然后返回。因此 `c.Next()` 之前是**请求阶段**，之后是**响应阶段**。这两个阶段都是你在中间件函数里自己写的代码，以 `c.Next()` 这一行为界。

handler 是最内层的业务函数：没有阶段之分，也从不叫 `Next()`。正常返回值路径要等整条链回溯完才自动写回，所以围着 `Next()` 计时测的是完整的请求处理耗时；直接 Write、Flush、SSE 和 Hijack 会提前提交。最外层访问日志在完整回溯后读取最终状态。

`Next()` 就是一个普通的阻塞调用：同步跑完下游所有环才返回。所有嵌套的 `Next` 共享同一个游标，任何环都不会被执行两次。

## 可运行的顺序示例

```go
gbl.Use(func(c *gbl.Context) {
    fmt.Println("engine before")
    c.Next()
    fmt.Println("engine after")
})

api := gbl.Group("/api")
api.GroupUse(func(c *gbl.Context) {
    fmt.Println("group before")
    c.Next()
    fmt.Println("group after")
})
api.Get("/ping", func() string {
    fmt.Println("handler")
    return "pong"
})

// 请求 GET /api/ping，日志依次输出：
//   engine before
//   group before
//   handler
//   group after
//   engine after
```

## 中断链：必须用 Abort

**要中断链，必须调 `Abort` 系列方法**：它把游标推到末尾之后，跳过所有尚未开始的环（含 handler）。

```go
c.Abort()                                    // 中断，不写任何内容
c.AbortWithStatusString(401, "unauthorized") // 以纯文本 body 拒绝
c.AbortWithStatusJSON(403, body)             // 以 JSON body 拒绝
```

两个容易踩的坑：

1. **不调 `c.Next()` 直接 `return` 并不能中断链**——外层驱动循环仍会推进到下一环。只有 `Abort` 才能拦下下游。

```go
// ✗ 错误：以为这样能拦住，其实 handler 照样跑
gbl.Use(func(c *gbl.Context) {
    if !allowed(c) { return }
    c.Next()
})

// ✓ 正确
gbl.Use(func(c *gbl.Context) {
    if !allowed(c) {
        c.AbortWithStatusString(http.StatusForbidden, "forbidden")
        return
    }
    c.Next()
})
```

2. **`Abort` 只向下游中断**，不会回头打断已经调用过 `c.Next()` 的上游中间件——那些环恢复后仍会执行 `c.Next()` 之后的代码。如需连上游的响应阶段一起跳过，在上游自己写 `if c.Aborted() { return }`。

## 注册时序

- 引擎级 `gbl.Use(...)`：在 `Run()` 组装链时合并，**`Run()` 之前**注册即可；
- 分组 `group.GroupUse(...)`：注册路由时快照，**必须先于该分组的路由注册**（见[路由分组](/docs/groups)）；
- 链在启动时冻结进每条路由，请求期零组装开销；
- `Run()` 之后引擎只读：再调 `Use` / `GroupUse` / 任何注册方法都会 panic。

`Use` 是变参，可一次装多环：

```go
gbl.Use(recoverer, requestID)
```

## 实用中间件示例

### 请求 ID + 计时

```go
gbl.Use(func(c *gbl.Context) {
    start := time.Now()
    c.Set("requestID", newRequestID())

    c.Next()

    log.Printf("%s %s -> %d (%s)",
        c.Request.Method, c.Request.URL.Path,
        c.StatusCode(), time.Since(start))
})
```

### 鉴权守卫

```go
gbl.Use(func(c *gbl.Context) {
    uid, ok := parseToken(c.Request.Header.Get("Authorization"))
    if !ok {
        c.AbortWithStatusJSON(http.StatusUnauthorized,
            map[string]string{"error": "unauthorized"})
        return
    }
    c.Set("uid", uid)
    c.Next()
})
```

### 响应阶段读取结果

handler 跑完后，正常返回值的暂存结果通常还没写回——中间件此刻能读到当前有效状态与返回值；直接 Write、Flush、SSE 或 Hijack 可能已经提交：

```go
gbl.Use(func(c *gbl.Context) {
    c.Next()
    if res, ok := c.Result().(string); ok {
        gbl.Info("handler returned", "len", len(res), "written", c.IsWritten())
    }
})
```

`c.Result()` 返回 handler 的原始返回值（首次读取才装箱）；`c.IsWritten()` 判断是否调用过 `Write`，包括零长度写入，仅 `WriteHeader` / `Flush` 不算。中间件**没有改写暂存 body 的 API**——想自己写响应，用 `AbortWithStatusString` / `AbortWithStatusJSON`（写 body 的同时中断链），或在 handler 里声明 `http.ResponseWriter` 参数完全接管。

### 访问日志（自己装）

框架自带的现成中间件只有一个：`gbl.Compress`（gzip 响应压缩，见[响应压缩](/docs/compression)）。访问日志不内置，一行就够：

```go
gbl.Use(func(c *gbl.Context) {
    start := time.Now()
    c.Next()
    gbl.Info("access", "method", c.Request.Method, "path", c.Request.URL.Path,
        "status", c.StatusCode(), "size", c.Size(), "cost", time.Since(start))
})
```

## 请求的完整生命周期

从请求到达到响应回到客户端：

1. **接收与分发。** `net/http` 接受连接、解析请求，调用引擎；若配置了 CORS，则是包着引擎的 `corsHandler`。
2. **CORS（仅配置时）。** 检查 `Origin`：预检直接应答；允许的来源加上 CORS 头；无 `Origin` 直接进引擎。
3. **方法与路由匹配。** 未知动词 → 501；先查该动词的静态 map，未命中再进动态树并填充路径参数；未注册 HEAD 借用 GET；未匹配 → 404 或 405 + Allow（OPTIONS 则 204）。
4. **构建 Context。** 从池中取一个 `Context`，装入请求、路径参数、该路由冻结的链与 logger。
5. **执行链。** `c.Next()` 驱动到终端 `routeEndpoint`，它调用 `invokeHandler()`：解析 → 装配 → 校验 → 反射调用 handler → 序列化暂存。
6. **写回响应。** 直接 `Write` 或 Hijack 后以应用写入为准；正常返回值路径在链路回溯后自动写回，保留已记录状态（默认 200），204/304/101 不写 body。临时 Content-Type 在执行前已设置，未提交时仍可由运行时序列化修正。
7. **收尾。** 清理 multipart 临时文件；Context、路径参数 map、响应写入器复位归还对象池。
8. **任何 panic** 都被恢复：响应未提交且未 Hijack 时，显式中止原样到达客户端，注册了 PanicProcessor 则由它接管，其余记日志并回通用 500；响应已提交后只记录非预期 panic，不再改写回答。

下一章：[Context 详解](/docs/context)——链路上唯一的数据载体。