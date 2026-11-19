# 配置

内核**不读任何配置文件**：默认值开箱即用，要改就在代码里用 `Configure` 覆盖，然后 `Run` 按这份配置启动。配置文件（YAML、环境变量、profile、配置中心）属于集成层的职责——未来的 gbl-boot 会解析这些来源，然后调用同一个 `Configure` 入口。

## Configure

```go
func Configure(fn func(*Config))
```

`fn` 拿到的是**已填好默认值**的配置，只赋值你关心的字段即可。在 `Run` 之前调用；传 nil 是空操作。

```go
gbl.Configure(func(c *gbl.Config) {
    c.Name = "myapp"
    c.Port = "8080"
    c.ReadTimeout = 5 * time.Second
})
```

## 完整示例

```go
package main

import (
    "time"

    "github.com/gblgo/gbl"
)

func main() {
    gbl.Configure(func(c *gbl.Config) {
        c.Name = "myapp"
        c.Port = "9802"

        // CertFile 与 KeyFile 同时给出则启用 TLS
        c.CertFile = "server.crt"
        c.KeyFile  = "server.key"

        c.ReadTimeout       = 10 * time.Second
        c.ReadHeaderTimeout = 5 * time.Second
        c.WriteTimeout      = 10 * time.Second
        c.IdleTimeout       = time.Minute
    })

    gbl.Get("/health", func() string { return "ok" })
    gbl.Run()
}
```

## Config 字段与默认值

```go
type Config struct {
    Name              string        // 应用名
    Port              string        // 监听端口，不带前导冒号
    CertFile          string        // TLS 证书文件路径
    KeyFile           string        // TLS 私钥文件路径
    ReadTimeout       time.Duration // 读完整个请求的最大时长
    ReadHeaderTimeout time.Duration // 读完请求头的最大时长
    WriteTimeout      time.Duration // 写完整个响应的最大时长
    IdleTimeout       time.Duration // keep-alive 连接的最大空闲等待
}
```

| 字段 | 默认 | 含义 |
|---|---|---|
| `Name` | `gbl` | 应用名 |
| `Port` | `9801` | 监听端口 |
| `CertFile` / `KeyFile` | 空 | 两者都给 ⇒ 启用 HTTPS；只给一个不启用 |
| `ReadTimeout` | `10s` | 读取整个请求的最长时间 |
| `ReadHeaderTimeout` | `5s` | 读取请求头的最长时间 |
| `WriteTimeout` | `10s` | 写出整个响应的最长时间 |
| `IdleTimeout` | `60s` | keep-alive 连接的最长空闲等待 |

时长字段是 `time.Duration`，直接用 Go 的写法：`5 * time.Second`、`90 * time.Second`、`time.Minute`。

## TLS 是推导出来的

`useTLS` 不直接设置：每次 `Configure` 返回后，框架按 `CertFile != "" && KeyFile != ""` 重新判定。设置或清空任一路径都会立即生效，不需要单独的开关。

路径原样交给标准库：**相对路径相对的是进程启动时的工作目录**，不是可执行文件所在目录。部署时工作目录不可控的话，在 `Configure` 里自行拼出绝对路径。

## 业务配置自理

内核只管服务运行参数。数据库连接、业务开关这类配置是应用自己的事——在你的代码里解析（环境变量、文件、配置中心都行），需要影响服务参数的部分再调 `Configure`。需要现成的文件/环境配置方案时，等未来的 gbl-boot 集成层。

下一章：[服务生命周期](/docs/lifecycle)。