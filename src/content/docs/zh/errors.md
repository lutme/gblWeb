# 错误与 panic

GBL 的错误策略刻意严格：**非预期 panic 永不回显内部信息**（原因进日志，客户端只拿通用 `500`）。只有两样东西会原样到达客户端——显式的 `Abort`，以及（若你装了）你的 `PanicProcessor`。

## 什么能到达客户端

| 来源 | 客户端看到 |
|---|---|
| `gbl.Abort(status, msg)` | 你给的 status + msg（纯文本） |
| `c.AbortWithStatus` / `c.AbortWithStatusJSON` | 你给的状态 / JSON body |
| 装配失败（缺字段、转换错误、非法 body） | 400 + 具体原因（客户端自己的输入问题） |
| 校验失败（`Validatable`） | 通用 400（细节只进日志） |
| 返回值序列化失败 | 500 + 固定文本 `response serialization failed` |
| 其他任何 panic | 通用 500 `Internal Server Error`（堆栈进日志） |
| 注册了 `PanicProcessor` | **以上所有被恢复的值都归它渲染** |

## Abort(status, msg)

```go
gbl.Get("/admin", func(c *gbl.Context) {
    if !isAdmin(c) {
        gbl.Abort(http.StatusForbidden, "forbidden") // status+msg 确实到达客户端
    }
    // ... 这里一个裸 panic 会是通用 500，细节被隐藏
})
```

`Abort` 必须在 handler 或中间件内调用。与裸 `panic` 不同，它的消息**保证**到达客户端。Context 上也有带状态/body 的变体：

```go
c.AbortWithStatus(http.StatusUnauthorized)          // 无 body，状态立即落线
c.AbortWithStatusJSON(http.StatusBadRequest, errBody) // JSON body + 中断链
```

## PanicProcessor：接管一切渲染

```go
type PanicProcessor func(err any) (any, HttpStatus)
type HttpStatus int
```

`RegisterPanicProcessor(p)` 在引擎上安装你的 panic 渲染器。**一旦注册，它就接管所有被恢复值的渲染**——显式中止和真实崩溃都归它。因此你要为"不泄露内部错误"负全责：

```go
gbl.RegisterPanicProcessor(func(err any) (any, gbl.HttpStatus) {
    // 返回统一、安全的信封；绝不要把 err 拼进 body
    return map[string]any{
        "code":    500,
        "message": "internal error",
    }, gbl.HttpStatus(500)
})
```

返回的 body 可以是任意可渲染值，渲染规则与 Content-Type 自动对齐：

| payload 类型 | body | Content-Type |
|---|---|---|
| `error` | `err.Error()` 纯文本 | text/plain |
| 结构体 / map | JSON | application/json |
| 数组 / 切片 | JSON | text/plain |
| `string` | 原样 | text/plain |
| 指针 / 接口 | 解一层后按上述规则 | 随解包结果 |
| 标量 | 格式化文本 | text/plain |

> 注意：`error` 走纯文本而不是 JSON——`errors.New` / `fmt.Errorf` 的字段全是未导出的，反射序列化只会得到空 `{}`，所以框架直接取消息文本。

## 已提交的 body 不可改写

如果 panic 发生时 body 已经写出（handler 注入了 `http.ResponseWriter` 并写过，或中间件已 `c.JSON`），响应无法重写——框架只把已记录的状态码（或默认 200）落线。这是 HTTP 的固有限制，不是 GBL 的特殊行为。

## 内部如何处理

- 每个请求的 panic 都被 `recover` 捕获，按上表渲染；
- 非预期 panic 以结构化字段记录：`error`（恢复值）+ `stack`（完整 goroutine 堆栈），经引擎 `Logger` 写出，任何后端都可检索；
- 框架自己的 404/405/413/501 与请求解析失败也走同一条 panic 管线（内部 `responseAbort` 值），所以注册了 `PanicProcessor` 后这些回答同样由你的渲染器产出——设计信封时要把它们考虑进去。

## 完整示例：统一错误信封

```go
func main() {
    gbl.RegisterPanicProcessor(func(err any) (any, gbl.HttpStatus) {
        // 所有出口统一信封，内部细节永不外泄
        return map[string]any{
            "ok":      false,
            "message": "request failed",
        }, gbl.HttpStatus(500)
    })

    gbl.Get("/boom", func() string {
        panic("database DSN leaked here") // 客户端只拿信封；DSN 进日志
    })

    gbl.Get("/deny", func(c *gbl.Context) {
        gbl.Abort(http.StatusForbidden, "forbidden") // 同样交给处理器渲染
    })

    gbl.Run()
}
```

下一章：[参数校验](/docs/validation)。