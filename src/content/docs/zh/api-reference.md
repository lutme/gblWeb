# API 总览

GBL 的全部导出符号速查。每个符号的详解与示例见对应章节。

## 路由注册

| 符号 | 签名 | 说明 |
|---|---|---|
| `Get` | `func Get(path string, fn any)` | 注册 GET；不读 body |
| `Head` | `func Head(path string, fn any)` | 注册 HEAD；未注册时自动借用 GET |
| `Post` | `func Post(path string, fn any)` | 注册 POST；按 Content-Type 读 body |
| `Put` | `func Put(path string, fn any)` | 注册 PUT；读 body |
| `Patch` | `func Patch(path string, fn any)` | 注册 PATCH；读 body |
| `Delete` | `func Delete(path string, fn any)` | 注册 DELETE；不读 body |
| `Options` | `func Options(path string, fn any)` | 注册 OPTIONS；未注册时自动 204 + Allow |
| `Match` | `func Match(methods []string, path string, fn any)` | 一个 handler 挂多个动词，大小写均可 |
| `Group` | `func Group(prefix string) RouteGroup` | 创建带前缀与作用域中间件的分组 |

详见[路由](/docs/routing)、[路由分组](/docs/groups)。

## 引擎与生命周期

| 符号 | 签名 | 说明 |
|---|---|---|
| `Run` | `func Run()` | 启动唯一引擎并阻塞；信号优雅停机 |
| `Shutdown` | `func Shutdown(ctx context.Context) error` | 主动优雅停机；幂等、跨 goroutine 安全 |
| `Use` | `func Use(middleware ...HandlerFunc)` | 追加全局中间件（Run 前注册） |

详见[服务生命周期](/docs/lifecycle)、[中间件](/docs/middleware)。

## 上下文

| 符号 | 说明 |
|---|---|
| `Context` | 请求上下文结构体；导出字段 `Request *http.Request`；池化，不得跨请求持有 |
| `Context.Next` | 执行链上剩余部分 |
| `Context.Abort` / `Aborted` | 中断链 / 查询是否中断 |
| `Context.AbortWithStatus` / `AbortWithStatusJSON` | 以状态 / JSON 拒绝并中断 |
| `Context.PathParam` | 按名取路径参数（中间件用） |
| `Context.Set` / `Get` | 请求级 key/value |
| `Context.JSON` / `String` / `Status` | 写响应 / 记录状态 |
| `Context.Result` / `IsWritten` / `StatusCode` / `Size` | 响应阶段观察 |
| `HandlerFunc` | `type HandlerFunc func(c *Context)`，中间件类型 |
| `RouteGroup` | 分组接口：Use + 全部动词 + Match，均返回自身可链式 |

详见[Context 详解](/docs/context)。

## 请求级取值

| 符号 | 签名 | 说明 |
|---|---|---|
| `Value` | `func Value[T any](c *Context, key string) (T, bool)` | 类型化读取；缺失/类型不符 → 零值+false；nil 安全 |
| `MustValue` | `func MustValue[T any](c *Context, key string) T` | 同上，只返回值 |

详见[请求级取值](/docs/values)。

## 错误与 panic

| 符号 | 签名 | 说明 |
|---|---|---|
| `Abort` | `func Abort(status int, msg string)` | 立即结束请求，status+msg 保证到达客户端 |
| `RegisterPanicProcessor` | `func RegisterPanicProcessor(p PanicProcessor)` | 安装 panic 渲染器，接管一切被恢复值的渲染 |
| `PanicProcessor` | `type PanicProcessor func(err any) (any, HttpStatus)` | 渲染器类型 |
| `HttpStatus` | `type HttpStatus int` | 渲染器返回的状态码类型 |

详见[错误与 panic](/docs/errors)。

## 校验

| 符号 | 签名 | 说明 |
|---|---|---|
| `Validatable` | `interface { Validate() error }` | 业务参数实现即自动校验（装配后、handler 前） |

详见[参数校验](/docs/validation)。

## 上传限额

| 符号 | 签名 | 默认 | 说明 |
|---|---|---|---|
| `ByteSize` | `type ByteSize int` | — | 字节数具名类型 |
| `SetMaxBodySize` | `func SetMaxBodySize(size ByteSize)` | 5 MiB | 总 body 硬上限，超限 413 |
| `SetMaxFileSize` | `func SetMaxFileSize(size ByteSize)` | 2 MiB | multipart 内存阈值（非上限） |
| `SetMaxUploadFileSize` | `func SetMaxUploadFileSize(size ByteSize)` | 1 MiB | 单文件硬上限，超限 413 |

详见[文件上传](/docs/uploads)。

## 日志

| 符号 | 签名 | 说明 |
|---|---|---|
| `Logger` | `interface { Info/Warn/Error(msg string, kv ...any) }` | 结构化日志契约 |
| `BannerLogger` | `interface { Banner(block string) }` | 可选伴随接口，原样输出启动横幅 |
| `SetLogger` | `func SetLogger(l Logger)` | 安装 Logger；nil 被忽略 |
| `NewStdLogger` | `func NewStdLogger(l *log.Logger) Logger` | 标准库 logger 适配器 |
| `AccessLog` | `func AccessLog(c *Context)` | 现成访问日志中间件 |

详见[日志](/docs/logging)。

## CORS

| 符号 | 签名 | 说明 |
|---|---|---|
| `SetCorsConfig` | `func SetCorsConfig(cc *CorsConfig)` | 安装跨域策略；nil 关闭；危险组合启动即拦截 |
| `CorsConfig` | 结构体（6 个导出字段） | AllowedOrigins/Methods/Headers、ExposedHeaders、AllowCredentials、MaxAge |

详见[跨域 CORS](/docs/cors)。

## 配置

| 符号 | 签名 | 说明 |
|---|---|---|
| `Configure` | `func Configure(fn func(*Config))` | 代码覆盖配置；fn 拿到已填默认值的 Config；Run 前调用；nil 空操作 |
| `Config` | 结构体（8 个导出字段） | Name/Port/CertFile/KeyFile + 四个超时；TLS 由双路径自动推导 |

详见[配置](/docs/configuration)。

## 默认值速记

| 项 | 默认 |
|---|---|
| 端口 | 9801 |
| 应用名 | gbl |
| readTimeout / readHeaderTimeout / writeTimeout / idleTimeout | 10s / 5s / 10s / 60s |
| 总 body / 内存阈值 / 单文件 | 5 MiB / 2 MiB / 1 MiB |
| 信号停机窗口 | 5s |
| TLS | 关闭（CertFile+KeyFile 同时给出才启用） |
| CORS | 关闭 |
| 日志输出 | 仅控制台（文件日志经 `SetLogger` 集成） |