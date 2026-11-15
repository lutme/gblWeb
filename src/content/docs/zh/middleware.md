# 中间件

```go
type HandlerFunc func(c *Context)
```

`HandlerFunc` 是洋葱链上的一环。整条链是一个有序切片——**引擎级 `Use`（最外）→ 分组 `Use` → … → 匹配到的 handler（最内）**，`Context` 里保存着一个指向当前环的游标。

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

handler 是最内层的业务函数：没有阶段之分，也从不叫 `Next()`。框架要等整条链回溯完，才把暂存 body 写进连接——所以围着 `Next()` 计时测的是完整的请求处理耗时，访问日志也放在这一阶段，因为此时结果与状态码已确定。

`Next()` 就是一个普通的阻塞调用：同步跑完下游所有环才返回。所有嵌套的 `Next` 共享同一个游标，任何环都不会被执行两次。

## 可运行的顺序示例

```go
gbl.Use(func(c *gbl.Context) {
    fmt.Println("engine before")
    c.Next()
    fmt.Println("engine after")
})

api := gbl.Group("/api")
api.Use(func(c *gbl.Context) {
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
c.Abort()                            // 中断，不写任何内容
c.AbortWithStatus(401)               // 以 401 拒绝，无 body，立即落状态
c.AbortWithStatusJSON(403, body)     // 以 JSON body 拒绝
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
        c.AbortWithStatus(http.StatusForbidden)
        return
    }
    c.Next()
})
```

2. **`Abort` 只向下游中断**，不会回头打断已经调用过 `c.Next()` 的上游中间件——那些环恢复后仍会执行 `c.Next()` 之后的代码。如需连上游的响应阶段一起跳过，在上游自己写 `if c.Aborted() { return }`。

## 注册时序

- 引擎级 `gbl.Use(...)`：在 `Run()` 组装链时合并，**`Run()` 之前**注册即可；
- 分组 `group.Use(...)`：注册路由时快照，**必须先于该分组的路由注册**（见[路由分组](/docs/groups)）；
- 链在启动时冻结进每条路由，请求期零组装开销。

`Use` 是变参，可一次装多环：

```go
gbl.Use(recoverer, requestID, gbl.AccessLog)
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

### 响应阶段改写 body

handler 跑完后，暂存结果还没写回——这是改写的窗口：

```go
gbl.Use(func(c *gbl.Context) {
    c.Next()
    if res, ok := c.Result().(string); ok && !c.IsWritten() {
        c.String(http.StatusOK, strings.ToUpper(res))
    }
})
```

`c.Result()` 返回 handler 的原始返回值（首次读取才装箱）；`c.IsWritten()` 判断 body 是否已被提交。一旦写过，框架不再覆盖。

### 内置访问日志

```go
gbl.Use(gbl.AccessLog)
// 每请求一行：method / path / status / size / duration，经引擎 Logger 写出
```

## 请求的完整生命周期

从请求到达到响应回到客户端：

1. **接收与分发。** `net/http` 接受连接、解析请求，调用引擎；若配置了 CORS，则是包着引擎的 `corsHandler`。
2. **CORS（仅配置时）。** 检查 `Origin`：预检直接应答；允许的来源加上 CORS 头；无 `Origin` 直接进引擎。
3. **方法与路由匹配。** 未知动词 → 501；在该方法的路由树里匹配并填充路径参数；未注册 HEAD 借用 GET；未匹配 → 404 或 405 + Allow（OPTIONS 则 204）。
4. **构建 Context。** 从池中取一个 `Context`，装入请求、路径参数、该路由冻结的链与 logger。
5. **执行链。** `c.Next()` 驱动到终端 `routeEndpoint`，它调用 `invokeHandler()`：解析 → 装配 → 校验 → 反射调用 handler → 序列化暂存。
6. **写回响应。** 若已有人写过 body，以它为准；否则用注册时选定的 Content-Type 写出暂存结果，先落已记录的状态码（默认 200）。
7. **收尾。** 清理 multipart 临时文件；Context、路径参数 map、响应写入器复位归还对象池。
8. **任何 panic** 都被恢复并渲染：显式 Abort 原样到达客户端；注册了 PanicProcessor 则由它接管；其余记日志并回通用 500。

下一章：[Context 详解](/docs/context)——链路上唯一的数据载体。