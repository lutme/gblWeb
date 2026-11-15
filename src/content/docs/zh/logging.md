# 日志

所有内部消息（恢复的 panic、校验失败、访问日志行、启动事件）都经引擎 `Logger` 路由，故目的地/格式由应用决定。

## Logger 接口

```go
type Logger interface {
    Info(msg string, keysAndValues ...any)
    Warn(msg string, keysAndValues ...any)
    Error(msg string, keysAndValues ...any)
}
```

`msg` 描述事件，其后是交替的 key/value。结构化后端（zap/slog）可直接消费；默认实现保持纯文本形态。

## 默认实现

经标准库 `log` 输出 `gbl: LEVEL msg k=v`：

```text
gbl: INFO access method=GET path=/hello status=200 size=10 duration=123µs
gbl: WARN unbound handler parameters handler=main.main reason=...
gbl: ERROR recovered panic error=... stack=...
```

- **真终端**会给级别标签上色：INFO 绿、WARN 黄、ERROR 红；
- 重定向到文件/管道时是纯文本，绝不泄漏 ANSI 转义码；
- Windows 控制台自动尝试开启 VT 处理，失败则保持纯文本。

## SetLogger 与 NewStdLogger

```go
gbl.SetLogger(myLogger) // 传 nil 会被忽略，框架始终保留一个可用 logger
```

不想实现接口、只想换个已有的 `*log.Logger`（你自己的 writer/flags/prefix），用 `NewStdLogger`：

```go
myLogger := log.New(os.Stdout, "app ", log.LstdFlags|log.Lmsgprefix)
gbl.SetLogger(gbl.NewStdLogger(myLogger))
```

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

横幅包含 logo 与状态表（version / listening / tls / routes），随后一条普通 Info：`started successfully, ready to accept requests`。

## AccessLog

现成中间件：每请求一行（方法、路径、状态、大小、耗时），经引擎 Logger 写出：

```go
gbl.Use(gbl.AccessLog)
```

它放在响应阶段读结果——`c.Next()` 之后状态码与大小已确定。更丰富的可观测性（metrics、tracing）同样是中间件：用 `c.StatusCode()`、`c.Size()` 与环绕 `c.Next()` 的计时自己实现，框架不内置任何传输依赖。

## 文件日志（配置驱动）

在 `application.ini` 的 `[gbl]` 段配置目的地：

```ini
[gbl]
logDir  = ./logs      # 自动创建 info.log / warn.log / error.log
# logFile = ./app.log  # 所有级别合并进一个文件（优先级最低）
# infoLog  = ./logs/info.log   # 逐级显式路径（优先级最高）
# warnLog  = ./logs/warn.log
# errorLog = ./logs/error.log
```

每个级别的目的地按优先级选择：**逐级显式路径 > logDir/<级别>.log > logFile**。规则：

- 配置了文件的级别**同时**输出到 stdout 和文件（镜像，不是二选一）；
- 多个级别指向同一路径时共享一个文件句柄；
- 没配置文件的级别仍打印到 stdout，控制台输出保持完整；
- 三个键全空 = 关闭文件日志，只走控制台；
- 目录不存在会自动创建；
- 所有打开的文件在 `Shutdown` 时关闭。

### 自定义 Logger 优先

装了 `SetLogger` 时，内置文件路由**不会覆盖你的 sink**——框架打印一条启动 Warn（`ini log keys ignored because a custom Logger is installed`）后就此让路。文件目的地与你的结构化后端只能选一个主导。

### 日志目的地坏掉时

配置了文件日志却打不开（路径错误、无权限、磁盘满）：启动失败，且原因三路兜底——控制台一行、可执行文件旁的 `gbl-start-error.log`、panic 值。详见[服务生命周期](/docs/lifecycle)。

下一章：[跨域 CORS](/docs/cors)。