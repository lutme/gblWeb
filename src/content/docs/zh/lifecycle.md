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

## Run 之后引擎只读

`Run` 会冻结全部装配期决定——路由注册、`Use` / `GroupUse`、`SetLogger`、`Configure`、CORS、大小上限、panic 渲染器。在 `Run` 之后调用它们（或重复调用 `Run`）会 panic 并给出明确的 *"必须在 Run 之前调用"* 提示，而不是被悄悄吞掉：错误的注册**顺序**和错误的注册**内容**一样是编程错误，值得同样响亮的对待。这类 panic 不再走启动日志（进程已过启动期），调用方自己的栈就直接指出错处。

## 启动横幅

```text
  ┏━╸  ┏┓   ╻
  ┃╺┓  ┣┻┓  ┃
  ┗━┛  ┗━┛  ┗━╸

  version    v0.1.0
  listening  http://localhost:9801
  tls        disabled
  routes     7

2026/11/15 10:00:00 INFO started successfully, ready to accept requests
```

- `version` 读自二进制内嵌的构建信息，无需维护版本常量：作为依赖编译进你的应用时，显示你 `go.mod` 要求的 gbl 标签版本；本地或 replace 构建为 `(devel)`；
- `listening` 把 `0.0.0.0` / `::` 显示为 `localhost`；
- `routes` 统计所有动词树里真实可路由的终端数（同一 handler 注册多个动词按多条计）；
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

- 可重复调用：只有成功才落锁，**失败的停机可以重试**（ctx 到期时服务仍在监听）；
- 可从**不同于 Run** 的 goroutine 调用；
- 在 `Run` 之前调用返回 `http.ErrServerClosed`；
- 信号路径收尾窗口耗尽时会记一条 WARN，不静默吞掉。

> `Run` 已自带信号优雅停机；当你需要**主动**触发（健康检查 kill 开关、测试、嵌入）时才用 `Shutdown`。

## 启动失败（fail-fast）

所有启动、配置、注册类失败都是 fail-fast：先经引擎 Logger 记录原因，再 panic——还没开始服务就挂掉的部署，也会在你的日志 sink 里留下原因，而不只是一条裸栈。端口占用、路由冲突、危险的 CORS 策略、不支持的 handler 形态（方法值/泛型实例化，见 [Handler 与参数装配](/docs/handlers)）、`-ldflags "-w"/"-s"` 剥除 DWARF 后按名字装配的 handler（见[部署与构建](/docs/deployment)）都走这条路。

```text
2026/11/19 10:00:00 ERROR startup aborted reason=listen tcp :9801: bind: address already in use
```

日志默认只在控制台；装了自定义 `Logger` 就落在你的 sink 里（见[日志](/docs/logging)）。内核不写任何兜底文件。

## 嵌入与测试

引擎本身实现了 `http.Handler`，但对外只有包级 API。测试你的业务时，直接用 `httptest` 打真实端口，或把 handler 函数单独单元测试——handler 就是普通函数，不依赖框架即可测业务逻辑。

下一章：[部署与构建](/docs/deployment)——参数名恢复对构建方式的要求。