# 服务生命周期

## Run() 的启动顺序

`gbl.Run()` 在配置的地址上启动唯一的引擎并**阻塞**直到停止。内部顺序刻意安排：

```text
1. 取 Configure 留下的配置（含默认值；内核不读任何文件）
2. generateRoute：校验 handler、构建装配计划、恢复参数名、冻结中间件链、插入路由树
3. 监听端口（占用 → 失败）
4. 组装 http.Server（超时来自配置；配置了 CORS 则包一层 corsHandler）
5. 发布 server 引用（并发的 Shutdown 能够到它）并挂上信号监听
6. 打印启动横幅 + 状态表
7. 开始服务（配置了 TLS 则 ServeTLS）
```

配置在 `Run` 之前就已由 `Configure` 定稿（见[配置](/docs/configuration)）；注册与配置类错误都在 generateRoute / 监听阶段暴露。任何致命启动错误都会 panic，且**先经 Logger 记录原因再 panic**（fail-fast）。

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
- 在 `Run` 之前调用返回 `http.ErrServerClosed`。

> `Run` 已自带信号优雅停机；当你需要**主动**触发（健康检查 kill 开关、测试、嵌入）时才用 `Shutdown`。

## 启动失败（fail-fast）

所有启动、配置、注册类失败都是 fail-fast：先经引擎 Logger 记录原因，再 panic——还没开始服务就挂掉的部署，也会在你的日志 sink 里留下原因，而不只是一条裸栈。端口占用、路由冲突、危险的 CORS 策略都走这条路。

```text
2026/11/19 10:00:00 gbl: ERROR startup aborted reason=listen tcp :9801: bind: address already in use
```

日志默认只在控制台；装了自定义 `Logger` 就落在你的 sink 里（见[日志](/docs/logging)）。内核不写任何兜底文件。

## 嵌入与测试

引擎本身实现了 `http.Handler`，但对外只有包级 API。测试你的业务时，直接用 `httptest` 打真实端口，或把 handler 函数单独单元测试——handler 就是普通函数，不依赖框架即可测业务逻辑。

下一章：[部署与构建](/docs/deployment)——参数名恢复对构建方式的要求。