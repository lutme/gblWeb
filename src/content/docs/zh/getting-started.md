# 快速上手

本节带你在五分钟内跑起第一个 GBL 服务，并理解一个请求从进入到返回的完整路径。

## 安装

```bash
go get github.com/gblgo/gbl
```

GBL 零依赖，这一步不会给你的 `go.mod` 引入任何间接依赖。要求 Go 1.27+。

## 第一个服务

新建 `main.go`：

```go
package main

import "github.com/gblgo/gbl"

func main() {
    gbl.Get("/hello", func() string {
        return "hello, gbl"
    })

    // 默认监听 :9801；Ctrl+C / SIGTERM 触发优雅停机
    gbl.Run()
}
```

运行：

```bash
go run .
```

启动后你会看到 GBL 的横幅、状态表，以及最后一条启动成功提示：

```text
  ┏━╸  ┏┓   ╻
  ┃╺┓  ┣┻┓  ┃      zero-dependency Go web framework
  ┗━┛  ┗━┛  ┗━╸

  version    (devel)
  listening  http://localhost:9801
  tls        disabled
  routes     1

2026/11/15 10:00:00 gbl: INFO started successfully, ready to accept requests
```

> `version` 取自构建信息：`go run` 或未打标签的本地构建显示 `(devel)`，tagged 版本会显示真实版本号。`listening` 会把 `0.0.0.0` / `::` 这类通配绑定显示为 `localhost`，方便直接点开。横幅块原样输出、不带前缀；最后的成功提示是普通 Info 记录，带时间戳与级别。

验证：

```bash
curl http://localhost:9801/hello
# hello, gbl
```

## 加上参数与 JSON

GBL 的核心能力是签名装配。把 `main.go` 扩展成：

```go
package main

import (
    "fmt"
    "strings"

    "github.com/gblgo/gbl"
)

type User struct {
    ID   int
    Name string
}

func main() {
    // 路径参数：:id 装配给名为 id 的参数
    gbl.Get("/user/:id", func(id string) string {
        return "user " + id
    })

    // query 参数：按名字绑定，自动转 int
    gbl.Get("/search", func(keyword string, limit int) string {
        return fmt.Sprintf("%s (limit=%d)", keyword, limit)
    })

    // JSON body：单个结构体参数 ← 整个 body
    gbl.Post("/user", func(u User) *User {
        u.Name = strings.ToUpper(u.Name)
        return &u
    })

    gbl.Run()
}
```

> 结构体字段必须导出（大写开头）：JSON 绑定走 `encoding/json`，只给导出字段赋值；小写字段被静默忽略、保持零值且不报错。响应序列化同理。

逐个验证：

```bash
curl http://localhost:9801/user/42
# user 42

curl "http://localhost:9801/search?keyword=gbl&limit=5"
# gbl (limit=5)

curl -X POST http://localhost:9801/user \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "name": "ada"}'
# {"ID":1,"Name":"ADA"}
```

注意第三个请求：你没有任何解码代码，`User` 自动从 body 装配，返回的 `*User` 自动变成 JSON，`Content-Type` 在注册时就根据返回类型选好了。

## 可选配置：application.ini

不给配置文件就全用默认。需要改端口、开 TLS 或文件日志时，在**工作目录**放一个 `application.ini`：

```ini
[gbl]
name = myapp
port = 9802

# certFile 与 keyFile 同时给出则启用 HTTPS
certFile = server.crt
keyFile  = server.key

readTimeout  = 10s
writeTimeout = 10s

# 按级别拆分日志文件：info.log / warn.log / error.log
logDir = ./logs
```

键名 `camelCase` 与 `kebab-case` 都接受（`readTimeout` 等价于 `read-timeout`）。完整键表见[配置](/docs/configuration)。

## 一个请求的完整旅程

以 `GET /user/42` 为例，GBL 内部依次发生：

```text
请求到达
  │
  ▼
net/http 接收连接、解析请求
  │
  ▼
（若配置了 CORS）corsHandler 检查 Origin
  │
  ▼
方法解析 + 路由树匹配，填充路径参数 {id: "42"}
  │
  ▼
从池中取出 Context，装入请求、路径参数、该路由冻结的中间件链
  │
  ▼
c.Next() 驱动洋葱链：
  全局中间件 → 分组中间件 → routeEndpoint
  │
  ▼
routeEndpoint 调用 invokeHandler：
  解析请求 → 按装配计划绑定参数 → 校验 → 反射调用 handler → 序列化结果暂存
  │
  ▼
链回溯（中间件 c.Next() 之后的代码执行）
  │
  ▼
写回暂存结果（Content-Type 注册时已选定）
  │
  ▼
清理 multipart 临时文件，Context 等对象复位归还对象池
```

两个值得记住的点：

1. **中间件链在启动时冻结**。`Run()` 才把全局中间件、分组中间件和终端 `routeEndpoint` 组装成每条路由的固定切片，请求期直接复用，不按请求重新组装。
2. **响应在链回溯完之后才写回**。所以 `c.Next()` 之后的中间件代码能读到最终状态码、响应大小和 handler 返回值——计时与访问日志都放在这一阶段。

细节分别见[中间件](/docs/middleware)与[Context 详解](/docs/context)。

## 优雅停机

`gbl.Run()` 自带信号处理：收到 `SIGINT`（Ctrl+C）或 `SIGTERM` 时关闭监听，给在途请求 5 秒收尾窗口，然后退出。需要从代码主动停机（健康检查开关、测试、嵌入场景）时用 `gbl.Shutdown(ctx)`，见[服务生命周期](/docs/lifecycle)。

## 下一步

- 装配的全部规则与边界：[Handler 与参数装配](/docs/handlers)
- 路径语法与匹配优先级：[路由](/docs/routing)
- 组织你的 API：[路由分组](/docs/groups)
- 横切逻辑（鉴权、日志、计时）：[中间件](/docs/middleware)