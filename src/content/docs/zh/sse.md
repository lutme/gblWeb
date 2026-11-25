# SSE 实时流

GBL 内置 [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) 支持。GET handler 声明一个 `gbl.SSEWriter` 参数即可进入 SSE 管线，不需要自己管理响应头、Flush、心跳或断连取消。

## 第一个事件流

```go
gbl.Get("/events/:topic", func(s gbl.SSEWriter, topic string) {
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-s.Done():
            return
        case <-ticker.C:
            event := map[string]any{"topic": topic, "at": time.Now()}
            if err := s.Send(event); err != nil {
                return
            }
        }
    }
})
```

浏览器可以直接订阅：

```javascript
const events = new EventSource("/events/news")
events.onmessage = (event) => {
    console.log(JSON.parse(event.data))
}
```

`EventSource` 使用标准 GET 请求，不能像 `fetch` 那样自由设置自定义请求头。需要认证时，可使用受控的 Cookie，或由应用实现独立的令牌端点。

## 路由约束

- `SSEWriter` 只能声明在 **GET** 路由上；其他方法会在启动时失败；
- SSE handler **不能有返回值**，所有事件都通过 `Send` 发送；
- 其他业务参数仍按普通规则绑定，支持路径、query 和结构体；
- 参数绑定与 `Validatable` 校验在流启动**之前**完成，失败仍返回普通 `400`；
- 未注册的 `HEAD` 会借用同路径 GET，因此也走 SSE 管线，但 `net/http` 不发送 body；
- 全局和分组中间件照常生效。

## SSEWriter 接口

```go
type SSEWriter interface {
    Send(v any) error
    Done() <-chan struct{}
    OnError(func(error))
    OnComplete(func())
}
```

### Send

`Send` 完成序列化、写帧和 Flush，任意一个阶段失败都会返回错误：

- `string` 和 `[]byte` 原样作为 data；
- 标量按普通返回值规则转换为文本；
- 复合值编码为 JSON；
- `error` 发送其消息；
- CRLF 和裸 CR 统一为 LF，多行内容拆成多个 `data:` 行；
- 末尾换行会保留为空 data 行，避免浏览器解码后丢失内容。

一次 `Send` 只发送一个 `data` 事件，不包含 `event:`、`id:` 或 `retry:` 字段。传入字符串也会被逐行加上 `data:` 前缀，不能借此直接生成这些协议字段。需要完全控制 SSE 帧时，请使用[原始 ResponseWriter](/docs/response-writer)实现自己的流。

### Done

`Done` 在以下情况关闭：

- 客户端断开或请求上下文取消；
- 写入、Flush 或写超时设置失败；
- handler 正常返回或 panic 展开；
- 框架开始优雅停机。

handler 必须自己 `select` 这个通道来停止业务循环。GBL 不会强行终止业务 goroutine，也不会替它关闭数据库、ticker 或其他资源。

## 启动过程与响应头

绑定和校验成功后，GBL 按顺序执行：

1. 设置 `Content-Type: text/event-stream`；
2. 设置 `Cache-Control: no-cache`；
3. 通过 `ResponseController` 设置写超时（配置允许时）；
4. 提交并 Flush 响应头；
5. 启动空闲心跳；
6. 调用业务 handler。

因此客户端在第一个业务事件产生前就能拿到 200 和流式响应头。

### 启动失败时客户端看到什么

| 失败阶段 | 客户端结果 | 日志与回调 |
|---|---|---|
| 参数绑定或校验 | 普通 400 | 按普通错误策略记录；业务 handler 未运行，无法注册流回调 |
| 响应头提交前失败 | 500 `Internal Server Error` | 记录 `SSE startup failed`；不调用业务回调 |
| 响应头已提交后失败 | 无法改为 500，连接终止 | 记录 `SSE startup failed`；不调用业务回调 |

启动失败发生在业务 handler 之前，因此 `OnError` / `OnComplete` 不会代替 HTTP 错误响应。

## 心跳与写超时

GBL 在空闲时发送 SSE 注释：

```text
: ping

```

注释用于保持连接和中间代理活跃，不会触发浏览器的 `onmessage`。心跳间隔为：

- 配置了正的 `WriteTimeout`：`max(1ns, min(WriteTimeout/2, 15s))`；
- 关闭或未配置写超时：固定 `15s`。

每次业务事件和心跳写入前都会重新设置写超时，所以 `WriteTimeout` 限制的是**单次写入**，不是整个流的寿命。底层不支持 `SetWriteDeadline` 时忽略该能力；真实超时设置错误会终止流。

## 生命周期回调

### OnError

`OnError` 在第一次运行时写入或 Flush 失败时调用一次，参数为真实错误。没有注册它时，第一次运行时流失败仍会由框架记录一次 `ERROR` 日志。

客户端主动断连不保证触发 `OnError`：通常表现为 `Done` 关闭，handler 退出并触发 `OnComplete`；若心跳或写入先观察到取消，也可能作为运行时流失败进入 `OnError`。`OnError` 覆盖写、Flush、写超时设置等运行时失败。

### OnComplete

`OnComplete` 在正常返回、panic 展开或流失败后调用一次。它与 `OnError` 不互斥：失败时可能先调用 `OnError`，再调用 `OnComplete`。

```go
gbl.Get("/jobs/:id", func(s gbl.SSEWriter, id string) {
    s.OnError(func(err error) {
        gbl.Warn("job stream failed", "id", id, "error", err)
    })
    s.OnComplete(func() {
        gbl.Info("job stream complete", "id", id)
    })

    if err := sendJobEvents(s, id); err != nil {
        return
    }
})
```

### 回调注册与并发约束

- 请在 handler 入口注册，避免错过终态；
- 流已终止后才注册时，会用保留的终态立即调用回调；
- 每个回调最多执行一次；
- 回调可能运行在请求 goroutine 或心跳 goroutine，必须快速返回；
- 回调中不能调用 `Send`，也不要启动会访问已回收 `Context` 的工作；
- 回调 panic 会被恢复并记录，不会让心跳 goroutine 崩溃；
- 需要异步清理时，只复制必要的标量数据，并自行管理 goroutine 的生命周期。

## 优雅停机

`Shutdown` 会先取消所有 SSE 流，再等待在途请求。监听 `Done` 的 handler 可以停止发送、执行清理并正常返回，从而让停机继续。

```go
gbl.Get("/events", func(s gbl.SSEWriter) {
    for {
        select {
        case <-s.Done():
            return
        default:
            if err := s.Send(time.Now().Format(time.RFC3339)); err != nil {
                return
            }
            time.Sleep(time.Second)
        }
    }
})
```

停机取消时，`Send` 会立即返回取消原因，不会继续写入。handler 不监听 `Done` 时，只能等待 `Shutdown` 的超时窗口耗尽。

## 中间件与压缩

SSE 的响应头会立即 Flush，业务事件也逐次直接写出。`Compress` 看到已提交或已写出的响应会跳过，不会把长连接改成 gzip 暂存响应。

访问日志中间件在 `c.Next()` 返回后才执行，因此它记录的是**整个流的持续时间**，不是首个事件的延迟。需要逐事件指标时，在业务发送循环中自行记录。

## 常见问题

### 为什么浏览器收不到第一个事件？

先确认 handler 是否进入循环、`Send` 是否返回错误，以及反向代理是否禁用了流式输出或缓冲了响应。GBL 会发送响应头和心跳；心跳不会触发 `onmessage`，这是正常现象。

### 为什么 Done 关闭后业务循环还在跑？

`Done` 只是通知通道。handler 必须 select 它，并停止自己的 ticker、goroutine 和外部任务；框架不会管理业务资源。

### SSE 与 WebSocket 是同一个功能吗？

不是。SSE 是服务端到客户端的单向文本流，使用普通 HTTP；WebSocket 是独立升级协议，支持双向通信。GBL 内置 SSE，WebSocket 可通过 [Hijack](/docs/response-writer) 集成应用选择的库。

下一章：[文件上传](/docs/uploads)——multipart 装配与三重独立限额。
