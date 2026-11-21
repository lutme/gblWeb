# 响应压缩

`Compress(level int) HandlerFunc` 返回一个 gzip 响应压缩中间件——这是框架**唯一自带**的现成中间件。压缩发生在 `c.Next()` 返回之后：handler 已产出结果、下游链已回溯完，中间件对**暂存的响应体**做压缩替换。

## 三个条件

三个条件同时成立才压缩，任一不满足就原样放行：

1. 客户端请求头带 `Accept-Encoding: gzip`；
2. 响应 `Content-Type` 可压缩——`text/*` 全类，以及 JSON、XML、CSS、JS、SVG、RSS/Atom 等文本格式；图片、视频、音频、PDF 等二进制类型永不压缩（已压缩过或 gzip 无收益）；
3. 响应体至少 **1 KB**——更小的响应压缩收益甚微，CPU 开销不值。

命中后：暂存 body 被替换为压缩数据，并设置 `Content-Encoding: gzip` 与 `Vary: Accept-Encoding`（对共享缓存友好）。

## 压缩级别

级别常量与 `compress/gzip` 一致、由框架重新导出——无需 import 标准库：

| 常量 | 值 | 含义 |
|---|---|---|
| `DefaultCompression` | -1 | 均衡（推荐默认） |
| `NoCompression` | 0 | 不压缩（仅存储） |
| `BestSpeed` | 1 | 最快 |
| `BestCompression` | 9 | 最小输出、最高 CPU |
| `HuffmanOnly` | -2 | 仅 Huffman 编码 |

传入非法级别不会报错——中间件静默跳过压缩，响应原样发出。

## 使用

全局：

```go
gbl.Use(gbl.Compress(gbl.DefaultCompression))
```

分组：

```go
api := gbl.Group("/api")
api.GroupUse(gbl.Compress(gbl.BestSpeed))
```

`Compress` 是普通中间件，遵守装配契约：必须在 `Run()` 之前经 `Use` / `GroupUse` 注册（见[服务生命周期](/docs/lifecycle)）。

## 中间件顺序

Compress 在响应阶段工作，行为由洋葱层级决定：

```go
gbl.Use(
    accessLog,                            // 最外层：响应阶段最后执行
    corsMiddleware,
    authMiddleware,                       // 拒绝发生在压缩层之外
    gbl.Compress(gbl.DefaultCompression), // 最内层：最先拿到 handler 结果
)
```

- 在 auth/CORS **之后注册**（更内层）：拒绝响应由外层写出，天然跳过压缩；
- 在访问日志**之后注册**（更内层）：响应阶段内层先执行，日志中间件在 `c.Next()` 返回后读到的 `c.Size()` 已是压缩后大小。

## 什么不会被压缩

- **已写出的响应**：handler 声明注入的 `http.ResponseWriter` 自己写的、或 `Abort` 系列写出的拒绝响应——body 已上线，中间件不碰；
- **没有暂存结果的请求**：handler 无返回值，或链路被 `c.Abort()` 中断在 handler 之前；
- 不满足三条件的：客户端不支持 gzip、二进制类型、body 不足 1 KB。

> Compress 压缩的是**返回值序列化管线**里的暂存 body——正常业务响应都走这条路，所以对你几乎总是生效；只有绕开管线的写法（注入 writer 自己写）才需要自己处理压缩。

下一章：[配置](/docs/configuration)。
