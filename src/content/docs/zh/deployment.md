# 部署与构建

按名字装配是 GBL 的核心手感，也是唯一与构建方式强相关的点。好消息：**普通的生产构建直接就能用**——没有包装命令、不用安装任何东西、没有代码生成、没有额外构建步骤。

## 参数名的两级恢复

Go 的反射只保留参数类型，不保留参数名。GBL 在启动时依次从两处独立来源恢复形参名，按函数的**源码位置**（`<file>:<line>`，运行时报告的位置键）匹配：

1. **handler 所在的源码文件（磁盘上）**——开发期路径：`go run`，或在源码树旁执行的普通 `go build`。两处来源都在时磁盘优先，保证旧二进制里的 DWARF 不会遮蔽你刚改过的源码；
2. **二进制自带的 DWARF 调试信息**——无源码的生产路径：多阶段镜像、裸二进制分发。编译器默认就输出 DWARF，而 `-trimpath` 只是重写记录的源码路径、**并不会剥除 DWARF**。

位置键同样能解析闭包与函数字面量，且不受 Go 1.27 对相同字面量的合并/重命名影响。

## 生产构建：照常构建即可

```bash
# -trimpath 不影响参数名恢复；镜像里没有生成文件、不需要额外工具
go build -trimpath -o app ./cmd/api
```

把这个二进制塞进容器、脱离源码运行，`func(id string)` 照样按名字装配。你的项目、仓库和最终镜像里**不含任何生成文件**，也**不需要任何额外工具**。

## 唯一要注意的：`-ldflags "-w"` / `"-s"`

这两个链接器 flag 会剥除调试信息——`-w` 禁用 DWARF，`-s` 省略符号表和调试信息。用它们构建、且磁盘上没有源码时，GBL 读不到参数名，按名字装配的 handler 会**在启动时直接中止**（fail-fast：先落日志再 panic），而不是悄无声息地什么都装不上：

```text
gbl: handler for GET /user/:id binds parameters by name, but the parameter
names are unavailable at runtime: no source on disk and no DWARF debug info
in the binary. The binary was likely built with `-ldflags "-w"` or `"-s"`,
which strip DWARF; rebuild without them so gbl can read the names from the
binary, or bind through a struct / *struct parameter whose field names come
from reflection
```

两条出路：

- **去掉 `-w` / `-s`**，保留 DWARF——这是推荐做法，体积增量通常可以接受；
- **改用 `struct` / `*struct` 参数装配**——字段名来自反射而非 DWARF，无论用什么构建 flag 都保留：

```go
// 依赖参数名：需要源码或 DWARF
gbl.Get("/search", func(keyword string, limit int) string { ... })

// 自描述：任何构建 flag 都行
type SearchQuery struct {
    Keyword string
    Limit   int
}
gbl.Get("/search", func(q SearchQuery) string { ... })
```

> 注意：多个业务参数时 JSON body 按形参名拆分顶层成员，仍然依赖名字；单结构体参数整块解码，完全自描述。

## 不受影响的情况

- **单个结构体 / 指向结构体的指针参数**：字段名来自反射，任何构建方式下都正常；
- 只声明注入类参数（`*Context`、`*http.Request`、`http.ResponseWriter`、上传文件）的 handler：不依赖名字；
- 参数名不可得但 handler 不需要名字时：静默落回位置占位符，启动正常，也不打警告（自描述绑定本来就与名字无关）。

## TLS

`Configure` 同时给出 `CertFile` 与 `KeyFile` 即启用 HTTPS：

```go
gbl.Configure(func(c *gbl.Config) {
    c.Port     = "443"
    c.CertFile = "/etc/tls/server.crt"
    c.KeyFile  = "/etc/tls/server.key"
})
```

只给其中一个不启用。证书路径相对**进程启动时的工作目录**解析，不是可执行文件所在目录；容器里建议用绝对路径。

## 容器化清单

- **信号**：`Run` 自带 SIGTERM 优雅停机（5 秒窗口），Kubernetes `terminationGracePeriodSeconds` 建议 ≥ 10；
- **端口**：`Configure` 的 `Port` 或默认 9801，与 Service/容器端口对齐；
- **日志**：默认只走控制台，由采集器收 stdout；需要文件时经 `SetLogger` 指向挂卷路径（见[日志](/docs/logging)）；
- **配置**：内核不读配置文件——环境变量/ConfigMap 由应用自行解析后调 `Configure`；
- **构建**：不用 `-ldflags "-w"/"-s"`（或对按名绑定的接口改用结构体装配）；**源码不需要进镜像**。

## 版本显示

横幅的 `version` 读自 `debug.ReadBuildInfo()`：作为依赖编译进你的应用时，显示你 `go.mod` 要求的 gbl 标签版本；`go run` / 本地 replace 构建显示 `(devel)`。无需在代码里维护版本常量。

下一章：[性能](/docs/performance)。
