# ResponseWriter 进阶

handler 声明 `http.ResponseWriter` 参数时，GBL 注入的是**未导出的包装写入器**。它仍然满足 `http.ResponseWriter`，并转发常用的可选能力；你不需要导出或构造它。

```go
gbl.Get("/raw", func(w http.ResponseWriter) {
    w.Header().Set("Content-Type", "text/plain; charset=utf-8")
    w.WriteHeader(http.StatusCreated)
    _, _ = w.Write([]byte("created"))
})
```

包装器与 `Context` 一样是池化对象，只在当前请求内有效。不要把它存进全局变量、缓存或跨越请求的 goroutine。

## 自动写回与手动写回

有返回值的 handler 默认由框架写回结果。以下操作会接管响应：

- `Write`：写入任意 body，包括零长度写入；框架不再自动写回返回值。
- `Hijack`：连接所有权已经转移，框架不再写任何 HTTP 响应。

仅调用 `WriteHeader` **不会**接管 body：如果 handler 有返回值，框架仍会在链路回溯后写入结果，并保留你记录的状态码。`204`、`304` 和 `101` 不写自动 body。

`Flush` 会提交当前状态码和响应头，但不会阻止之后的 body 写入。因此，返回值 handler 在中间件中 `Flush` 后，仍可能在链路结束时自动写入返回值。

## Content-Type 与 Flush

对于有返回值的 handler，GBL 在中间件和业务代码执行**之前**，根据静态返回类型设置临时 `Content-Type`：

| 静态返回类型 | 临时 Content-Type |
|---|---|
| `string`、`[]byte`、bool、数字、复数 | `text/plain; charset=utf-8` |
| 结构体、map、数组、非字节切片、指向复合类型的指针、接口 | `application/json; charset=utf-8` |
| 指向标量的指针 | `text/plain; charset=utf-8` |

这样中间件或 handler 调用 `Flush` 时，客户端不会拿到缺失或错误的类型。响应头一旦提交就不能再修改。

如果响应尚未提交，运行时序列化可以修正类型。例如静态类型为接口的值实际返回 `error` 时最终使用纯文本；静态类型为指针但实际为 nil 时最终为空 body 和纯文本类型。中间件在运行时类型不变时可以覆盖临时 `Content-Type`，框架不会重复写回同名头。

## 状态码语义

包装器遵循 `net/http` 的提交规则，并补齐流式响应需要的 1xx 行为：

- `100`–`199`（除 `101`）立即转发，不记作最终状态；最终状态仍可随后设置；
- `101 Switching Protocols` 是最终状态，立即提交，不再自动写 body；
- 第一个 `200`–`999` 状态码被记录，之后的 `WriteHeader` 被忽略；
- 状态码不在 `100`–`999` 内会 panic；
- 第一次 `Write` 或 `Flush` 会提交已记录状态；未记录时默认 `200`。

```go
gbl.Get("/hints", func(w http.ResponseWriter) {
    w.Header().Set("Link", "</app.css>; rel=preload; as=style")
    w.WriteHeader(http.StatusEarlyHints) // 103，立即发送
    w.Header().Set("Content-Type", "text/plain; charset=utf-8")
    w.WriteHeader(http.StatusOK)
    _, _ = w.Write([]byte("ready"))
})
```

`204 No Content` 和 `304 Not Modified` 不承载 body。`Context.Size()` 对 1xx、204、304 返回 0；直接向这些状态写 body 时，最终错误由底层 `net/http` 决定。

## 可选接口

包装器实现 `http.Flusher`、`http.Hijacker`、`http.Pusher`，并提供 `FlushError` 与 `Unwrap`。是否真的支持某项能力，取决于底层 `ResponseWriter`。

| 能力 | 使用方式 | 不支持时 |
|---|---|---|
| Flush | `http.NewResponseController(w).Flush()` | 返回 `http.ErrNotSupported` |
| Hijack | `http.NewResponseController(w).Hijack()` | 返回 `http.ErrNotSupported` |
| HTTP/2 Push | `w.(http.Pusher).Push(...)` | 返回 `http.ErrNotSupported` |
| 写超时 | `ResponseController.SetWriteDeadline` | 返回 `http.ErrNotSupported` |

包装器满足 `http.Flusher`，因此类型断言总会成功；但底层不支持时 `Flush()` 是空操作。需要识别能力缺失或真实错误时，优先使用 `ResponseController` 或 `FlushError() error`。

### ResponseController 与 Unwrap

`Unwrap() http.ResponseWriter` 让 `http.ResponseController` 继续寻找包装器没有直接转发的能力，例如 `SetWriteDeadline`、`SetReadDeadline` 和 `EnableFullDuplex`。

```go
gbl.Get("/stream", func(w http.ResponseWriter) {
    controller := http.NewResponseController(w)
    if err := controller.SetWriteDeadline(time.Now().Add(30 * time.Second)); err != nil {
        if errors.Is(err, http.ErrNotSupported) {
            return
        }
        return
    }

    w.Header().Set("Content-Type", "text/plain; charset=utf-8")
    if err := controller.Flush(); err != nil {
        return
    }
    _, _ = w.Write([]byte("connected\n"))
})
```

GBL 内置的 [SSE](/docs/sse) 已经使用 `ResponseController` 管理 Flush 和写超时，普通 SSE 业务不需要重复实现。

## Hijack

`Hijack` 把 HTTP 连接从 `net/http` 服务循环转移到应用手中：

```go
gbl.Get("/tunnel", func(w http.ResponseWriter) {
    conn, buffered, err := http.NewResponseController(w).Hijack()
    if err != nil {
        return
    }
    defer conn.Close()

    // 这里由应用负责协议、读写循环、超时和关闭。
    _, _ = buffered.WriteString("HTTP/1.1 101 Switching Protocols\r\n")
    _, _ = buffered.Flush()
})
```

Hijack 成功后：

- 包装器不再自动写响应；后续 `Write` 返回 `http.ErrHijacked`；
- 应用必须关闭连接、设置超时，并正确管理读写 goroutine；
- `buffered` 可能已经包含客户端在握手后提前发送的数据，不能丢弃；
- GBL 会跟踪连接，但不会替你执行业务协议；
- 成功执行 `Shutdown` 后，GBL 关闭仍被跟踪的 Hijack 连接。应用自行关闭后会从跟踪表移除；
- Hijack 连接不再由 `http.Server.Shutdown` 等待，因此处理器必须主动响应 `Done` 或自己的停机信号。

GBL 核心不内置 WebSocket 协议。应用可以使用自己选择的 WebSocket 库，由库通过标准 `http.Hijacker` 完成升级；这不会给 GBL 增加依赖。

## Pusher

`http.Pusher` 只在使用支持 HTTP/2 服务端推送的底层服务器时可用。GBL 仅转发 `Push`，不内置静态资源推送策略；HTTP/1.x 或未启用 Push 的 writer 会返回 `http.ErrNotSupported`。

## 与返回值和压缩中间件的关系

- 直接 `Write` 后，`Compress` 不会压缩已经上线的 body；
- `Flush` 提交响应头后，`Compress` 同样跳过；
- 只调用 `WriteHeader` 时，返回值的暂存 body 仍可能被框架写回；
- 需要完全自定义成功状态和 body 时，直接 `WriteHeader` + `Write` 是最清晰的写法。

下一章：[路由](/docs/routing)——路径语法、匹配优先级与自动兜底。
