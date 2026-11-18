# 服务生命周期

## Run() 的启动顺序

`gbl.Run()` 在配置的地址上启动唯一的引擎并**阻塞**直到停止。内部顺序刻意安排：

```text
1. 读取 application.ini 快照（缺失 = 空配置；非法 = 致命）
2. 先初始化日志（目的地是纯字符串，不会解析失败）
3. 解析完整配置（非法值此时已能写进配置的日志文件）
4. generateRoute：校验 handler、构建装配计划、恢复参数名、冻结中间件链、插入路由树
5. 监听端口（占用 → 失败）
6. 打印启动横幅 + 状态表
7. 开始服务（配置了 TLS 则 ServeTLS）
```

**日志先于其余配置校验启动**——这样连非法配置值、路由冲突、端口占用都能落在你配置的日志文件里，而不只是 stderr。

任何致命启动错误都会 panic，且**先经 Logger 记录原因再 panic**（fail-fast）。

## 启动横幅

```text
  ┏━╸  ┏┓   ╻
  ┃╺┓  ┣┻┓  ┃      zero-dependency Go web framework
  ┗━┛  ┗━┛  ┗━╸

  version    (devel)
  listening  http://localhost:9801
  tls        disabled
  routes     7

2026/11/15 10:00:00 gbl: INFO started successfully, ready to accept requests
```

- `version` 读自构建信息，无需维护版本常量；本地构建为 `(devel)`；
- `listening` 把 `0.0.0.0` / `::` 显示为 `localhost`；
- `routes` 统计所有动词树里真实可路由的终端数（Match 挂多个动词按多条计）；
- 实现了 `BannerLogger` 的 Logger 拿到整块原样输出；否则作为一条 Info。
- 横幅块之后紧跟一条普通 Info：`started successfully, ready to accept requests`，带时间戳与级别。

## 优雅停机

### 信号触发（自动）

收到 `SIGINT`（Ctrl+C）或 `SIGTERM` 时：关闭监听 → 给在途请求 **5 秒**收尾窗口 → 退出。容器编排（Kubernetes、docker stop）发的就是 SIGTERM，开箱即用。

### Shutdown(ctx)（主动）

```go
func Shutdown(ctx context.Context) error
```

优雅停止由 `Run` 启动的服务，等待在途请求直到 `ctx` 到期：

```go
// 典型用法：从另一个 goroutine（如管理接口）触发停机
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
if err := gbl.Shutdown(ctx); err != nil {
    log.Fatal(err)
}
```

- 可重复调用（内部 once 收敛）；
- 可从**不同于 Run** 的 goroutine 调用；
- 在 `Run` 之前调用返回 `http.ErrServerClosed`；
- 关闭时同时关闭所有日志文件句柄。

> `Run` 已自带信号优雅停机；当你需要**主动**触发（健康检查 kill 开关、测试、嵌入）时才用 `Shutdown`。

## 启动失败与日志兜底

所有启动、配置、注册类失败都是 fail-fast：先经引擎 Logger 记录原因，再 panic——还没开始服务就挂掉的部署，也会在日志里留下原因，而不只是一条裸栈。

### 当日志目的地本身坏掉

配置了文件日志却打不开（路径错误、无写权限、磁盘满）时，没有文件可供写入原因。GBL 同时走**三路兜底**：

1. 恢复**默认控制台 logger**，打印一行错误，写明原因与修复方法；
2. 把一份通俗说明写入**运行中可执行文件旁边的 `gbl-start-error.log`**（一个你永远知道位置的地方，与启动工作目录无关）；
3. 以原因和指向该文件的提示 panic。

```text
2026-11-13T10:00:00+08:00
gbl: startup aborted - the configured file logging could not be initialized.
Reason: open /var/log/gbl/error.log: permission denied
Fix: check the logFile/logDir/infoLog/warnLog/errorLog value in application.ini;
     the path must exist and be writable. Then restart.
```

两个细节：

- 兜底文件**仅**在配置了文件日志却打不开时才出现。从未启用文件日志 ⇒ 不会有这个文件；其他启动失败（路由冲突、非法配置、端口占用）只打到控制台/已配置的日志。
- `go run .` 时的"可执行文件"是临时构建产物，兜底文件落在临时构建目录；`go build` 后运行二进制时，落在**该二进制旁边**。

## 嵌入与测试

引擎本身实现了 `http.Handler`，但对外只有包级 API。测试你的业务时，直接用 `httptest` 打真实端口，或把 handler 函数单独单元测试——handler 就是普通函数，不依赖框架即可测业务逻辑。

下一章：[部署与构建](/docs/deployment)——参数名恢复对构建方式的要求。