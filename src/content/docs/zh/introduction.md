# 简介

**GBL**（Grand Blue Lore，伟大蓝色真理）是一个**零依赖**的 Go Web 框架。只用 Go 标准库就能跑起一个完整的 HTTP 服务，`go.mod` 里除了模块声明没有任何第三方包。

它的核心主张只有一句话：

> **handler 签名随便写，框架自动把参数装配好、把返回值序列化好。**

你不再需要写 `r.URL.Query().Get(...)`、`json.NewDecoder(r.Body).Decode(...)`、`strconv.Atoi(...)` 这类胶水代码——业务函数长什么样，API 就长什么样。

## 一个最小例子

```go
package main

import "github.com/gblgo/gbl"

func main() {
    gbl.Get("/hello", func() string {
        return "hello, gbl"
    })
    gbl.Run() // 默认监听 :9801
}
```

`GET http://localhost:9801/hello` 返回纯文本 `hello, gbl`。没有引擎实例、没有路由表对象、没有上下文解码——注册即生效。

## 设计哲学

### 签名即 API

GBL 在启动时读取每个 handler 的函数签名，按**类型 + 名字**为每个参数预计算装配计划：

- `*gbl.Context`、`*http.Request`、`http.ResponseWriter`、上传文件类型 → 框架直接注入；
- 其余任意类型 → 按参数名从路径参数、JSON body 或 form/query 中绑定；
- 返回值 → 按类型自动序列化为纯文本或 JSON。

```go
// 路径段 :id 自动装配给名为 id 的参数，并转成 int
gbl.Get("/user/:id", func(id int) string {
    return fmt.Sprintf("user %d", id)
})

// 整个 JSON body 自动解码进 User
gbl.Post("/user", func(u User) *User {
    u.Name = strings.ToUpper(u.Name)
    return &u // 指针自动序列化为 JSON
})
```

### 一个引擎，多个入口

GBL 只暴露**一个**包级引擎。`Get/Post/Use/Group/Run/...` 全部作用于它，所以你注册的规则和你启动的服务必然是同一实例，不存在"注册进第二个引擎"的坑。对外不存在引擎实例，路由分组只以 `Group` 返回的 `RouteGroup` 句柄存在。

### 严格错误策略

非预期 panic **永不回显内部信息**：原因写进服务端日志，客户端只拿通用 `500`。回显权按**消息是谁写的**划分——开发者写的原样到达客户端：显式的 `Abort`、你注册的 `PanicProcessor`、`Validate` 返回的错误文本；框架拼出的内部细节（绑定失败的反射信息）只进日志，客户端拿通用 `400`。

### 失败要趁早（fail-fast）

路由冲突、非法路径语法、非法配置、无法恢复参数名……所有注册与配置类错误都在**启动时**暴露：先经日志记录原因，再 panic。部署还没开始服务就挂掉时，日志里一定留有原因，而不是一条裸栈。

## 能力总览

| 领域 | 能力 |
|---|---|
| 路由 | 7 种 HTTP 动词、`:name` 与 `{name}` 路径参数、静态优先匹配、HEAD/OPTIONS 自动兜底、路由分组 |
| 装配 | 路径/query/form/JSON/multipart 按类型+名字自动绑定，支持标量、指针、切片、数组、嵌套结构体 |
| 中间件 | 洋葱模型、`c.Next()` 请求/响应两阶段、分组作用域、`Abort` 一步拦截 |
| 上下文 | 池化 `Context`、请求级 key/value、泛型取值 `Value[T]` / `MustValue[T]` |
| 校验 | `Validatable` 接口，装配后 handler 前自动校验 |
| 错误 | `Abort` / `PanicProcessor` / 通用 500 兜底，内部细节零泄漏 |
| 日志 | 结构化 `Logger` 接口、彩色控制台、`SetLogger` 接入任意后端、`AccessLog` 中间件、启动横幅 |
| 配置 | `Configure` 代码配置、TLS、超时；内核不读配置文件 |
| 上传 | 三重独立限额（总 body / 内存阈值 / 单文件），413 拒绝 |
| CORS | 结构体配置、预检处理、凭据+通配符危险组合启动即拦截 |
| 生命周期 | 信号优雅停机、`Shutdown` 主动停机、启动失败先日志后 panic |

## 环境要求

- **Go 1.27+**（`go.mod` 声明 `go 1.27`）
- 无第三方依赖，`go get github.com/gblgo/gbl` 即可
- 按名字绑定的 handler 需要运行时能读到源码（详见[部署与构建](/docs/deployment)中的 `-trimpath` 说明）

## 接下来读什么

- 想立刻跑起来：[快速上手](/docs/getting-started)
- 想理解核心机制：[Handler 与参数装配](/docs/handlers)
- 想查某个符号：[API 总览](/docs/api-reference)

## 开源协议

MIT © lutme · 仓库地址 [github.com/gblgo/gbl](https://github.com/gblgo/gbl)