# 部署与构建

本章讲 GBL 独有的一个部署约束：**按名字绑定需要运行时能读到源码**。理解它，才能正确打包镜像与选择构建参数。

## 为什么需要源码

Go 的反射只保留参数类型，不保留参数名。GBL 在启动时解析 handler 所在的源码文件（AST），按函数的**源码位置**（运行时报告的入口行号）恢复形参名——闭包也能正确解析到最内层函数字面量。

这意味着：编译时的源码路径，在运行时必须仍然可读。

## 会出问题的构建方式

| 构建方式 | 后果 |
|---|---|
| `go build -trimpath` | 源码路径被裁剪，运行时读不到 → 按名字绑定的 handler **启动失败** |
| Docker 多阶段镜像只 COPY 二进制 | 源码不在最终镜像里 → 同上 |
| 裸二进制分发到无源码机器 | 同上 |

失败是**启动时**的明确报错（fail-fast），不是请求期的静默错绑：

```text
gbl: handler for GET /user/:id binds parameters by name, but the parameter
names are unavailable at runtime (source not readable, e.g. built with
-trimpath or shipped as a bare binary). Rebuild without -trimpath, or bind
through a struct / *struct parameter whose field names come from reflection
```

## 不受影响的情况

- **单个结构体 / 指向结构体的指针参数**：字段名来自反射，不需要源码。这类 handler 在任何构建方式下都正常；
- 只声明注入类参数（`*Context`、`*http.Request`、`http.ResponseWriter`）的 handler：不依赖名字；
- 参数名恢复失败但 handler 不需要名字时：启动正常，仅记录一条 Warn。

## 三种解法

### 解法 1：保留源码路径（最直接）

不用 `-trimpath`；多阶段镜像把源码按编译时的路径结构一并拷贝：

```dockerfile
FROM golang:1.27 AS build
WORKDIR /src
COPY . .
RUN go build -o /app/server .

FROM golang:1.27
WORKDIR /src
COPY --from=build /src /src          # 源码保留在编译路径
COPY --from=build /app/server /app/server
CMD ["/app/server"]
```

### 解法 2：用结构体参数（最干净）

把需要按名绑定的标量参数收进一个结构体——字段名来自反射，与源码无关：

```go
// 依赖参数名：需要源码
gbl.Get("/search", func(keyword string, limit int) string { ... })

// 自描述：任何构建方式都行
type SearchQuery struct {
    Keyword string
    Limit   int
}
gbl.Get("/search", func(q SearchQuery) string { ... })
```

> 注意：多个业务参数时 JSON body 按形参名拆分顶层成员，仍然依赖名字；单结构体参数整块解码，完全自描述。

### 解法 3：混合

对部署形态敏感的接口用结构体装配，开发期工具接口保留标量签名。

## TLS

`application.ini` 同时给出 `certFile` 与 `keyFile` 即启用 HTTPS：

```ini
[gbl]
port     = 443
certFile = /etc/tls/server.crt
keyFile  = /etc/tls/server.key
```

只给其中一个不启用。证书路径相对工作目录解析，容器里建议用绝对路径。

## 容器化清单

- **信号**：`Run` 自带 SIGTERM 优雅停机（5 秒窗口），Kubernetes `terminationGracePeriodSeconds` 建议 ≥ 10；
- **端口**：ini 的 `port` 或默认 9801，与 Service/容器端口对齐；
- **日志**：容器推荐只走控制台（不配文件键），由采集器收 stdout；需要文件时用 `logDir` 挂卷；
- **配置**：`application.ini` 放工作目录，或用 ConfigMap 挂载到工作目录；
- **源码**：按上文三种解法之一处理参数名约束。

## 版本显示

横幅的 `version` 读自 `debug.ReadBuildInfo()`：以 `go install github.com/gblgo/gbl@vX.Y.Z` 或 tagged 依赖构建时显示真实版本；`go run` / 本地 replace 显示 `(devel)`。无需在代码里维护版本常量。

下一章：[性能](/docs/performance)。