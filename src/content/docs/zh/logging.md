# 日志

两个来源，一个出口。框架内部产生的每一条消息（恢复的 panic、绑定失败、启动中止），以及业务代码经 `gbl.Info` / `gbl.Warn` / `gbl.Error` 写的每一行日志，都流经引擎上装配的那**一个** `Logger`——发往哪里、什么格式、带不带颜色，全由这个 sink 说了算。

## Logger 接口

```go
type Logger interface {
    Info(msg string, keysAndValues ...any)
    Warn(msg string, keysAndValues ...any)
    Error(msg string, keysAndValues ...any)
}
```

`msg` 描述事件，其后是交替的 key/value。结构化后端（zap/slog）可直接消费；默认实现保持纯文本形态。这个接口就是**唯一的集成契约**：实现它、装上它，就完了。

## 默认控制台（开发辅助）

没有 `SetLogger` 之前，框架与业务日志打印到控制台：

```text
2026-11-20 16:12:38 INFO started port=9801
2026-11-20 16:12:39 ERROR recovered panic error=... stack=...
```

- 形态：标准日期/时间前缀之后的 `LEVEL msg key=value ...`；
- **真终端**上级别词着色——INFO 绿、WARN 黄、ERROR 红；管道、重定向、CI 下保持纯文本，绝不泄漏 ANSI 转义码；设置环境变量 `NO_COLOR` 可在真终端上主动关闭颜色；
- Windows 控制台自动尝试开启 VT 处理，失败则保持纯文本；
- 默认 sink 是一个**私有** `log.Logger`，从不借用标准库的全局 logger：你的 `log.SetOutput` / `log.SetFlags` 移动不了、也改不了框架日志的样式；框架日志同样不会捕获或染色你自己的 `log.Println`——两条通道完全隔离。想让框架日志去别处，只有一条路：`SetLogger`。

## 业务入口：Info / Warn / Error

包级三函数是给业务代码的人体工学入口：

```go
gbl.Get("/user", func(id string) string {
    gbl.Info("user loaded", "id", id) // → 引擎当前装的 Logger
    return fetch(id)
})
```

`SetLogger` 注入之后，那就是框架的出口，直接调框架 API 即可复用，无需自己保存或取回任何引用。框架内部事件走的是同一个出口，所以装一次，所有日志的去向就都定了。

## SetLogger

```go
gbl.SetLogger(myLogger) // 传 nil 会被忽略，框架始终保留一个可用 logger
```

和所有装配 API 一样，必须在 **`Run` 之前**调用——服务期间引擎只读，`Run` 之后再调会 panic（见[生命周期](/docs/lifecycle)）。接 zap/slog/zerolog 就是一个薄适配器：把 `msg` 与键值对转发给你的 logger 实例。

### 接入 zap 的一行适配器

```go
type zapLogger struct{ l *zap.SugaredLogger }

func (z zapLogger) Info(msg string, kv ...any)  { z.l.Infow(msg, kv...) }
func (z zapLogger) Warn(msg string, kv ...any)  { z.l.Warnw(msg, kv...) }
func (z zapLogger) Error(msg string, kv ...any) { z.l.Errorw(msg, kv...) }

gbl.SetLogger(zapLogger{l: zap.NewProduction().Sugar()})
```

### 接入 slog

```go
type slogLogger struct{ l *slog.Logger }

func (s slogLogger) Info(msg string, kv ...any)  { s.l.Info(msg, kv...) }
func (s slogLogger) Warn(msg string, kv ...any)  { s.l.Warn(msg, kv...) }
func (s slogLogger) Error(msg string, kv ...any) { s.l.Error(msg, kv...) }

gbl.SetLogger(slogLogger{l: slog.Default()})
```

## BannerLogger（可选伴随接口）

```go
type BannerLogger interface {
    Banner(block string)
}
```

同时实现了 `BannerLogger` 的 Logger 会拿到预渲染成多行的启动横幅块，可原样输出，不必让时间戳/级别标签挤乱 ASCII art。只实现 `Logger` 的也照样收到横幅，只是作为普通 Info 记录。

```go
func (l appLogger) Banner(block string) {
    fmt.Println(block) // 干净打印 art，无前缀
}
```

横幅包含 logo 与状态表（version / listening / tls / routes），随后一条普通 Info：`started successfully, ready to accept requests`。version 从二进制内嵌的构建信息读取：作为依赖被编译进你的应用时，显示的是你 `go.mod` 里要求的 gbl 标签版本；本地或 replace 构建显示 `(devel)`。

## API 监控归你

框架**有意**不带访问日志中间件。监控 API 调用情况是应用层面的事，而写一行中间件所需的信息链路上全都有——自己装一个：

```go
gbl.Use(func(c *gbl.Context) {
    start := time.Now()
    c.Next()
    gbl.Info("access", "path", c.Request.URL.Path,
        "status", c.StatusCode(), "size", c.Size(), "cost", time.Since(start))
})
```

它放在响应阶段读结果——`c.Next()` 之后状态码与大小已确定。更丰富的可观测性（metrics、tracing）同样是中间件：用 `c.StatusCode()`、`c.Size()` 与环绕 `c.Next()` 的计时自己实现，框架不内置任何传输依赖。

## 文件日志（集成示例）

框架本身**只打印控制台**，不内置文件日志。要写文件，对着任意 writer 实现接口即可——比如下面这个指向文件的标准库 `log` 版本：

```go
type fileLogger struct{ l *log.Logger }

func (s fileLogger) Info(msg string, kv ...any)  { s.emit("INFO", msg, kv) }
func (s fileLogger) Warn(msg string, kv ...any)  { s.emit("WARN", msg, kv) }
func (s fileLogger) Error(msg string, kv ...any) { s.emit("ERROR", msg, kv) }

func (s fileLogger) emit(level, msg string, kv []any) {
    s.l.Printf("%s %s %v", level, msg, kv)
}

f, err := os.OpenFile("app.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
if err != nil {
    log.Fatal(err)
}
gbl.SetLogger(fileLogger{l: log.New(f, "", log.LstdFlags)})
```

想控制台与文件双写，把 `log.New` 的 writer 换成 `io.MultiWriter(os.Stdout, f)`。日志轮转、按级别分文件等更完整的能力，交给 zap/slog 适配器或未来的 gbl-boot 集成层——内核不内置文件日志，也不写任何兜底文件。

下一章：[跨域 CORS](/docs/cors)。
