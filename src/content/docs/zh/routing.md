# 路由

GBL 的路由是**包级动词注册**：一次注册一个动词，参数为 `path` + handler。所有注册都作用于同一个包级引擎。

## 动词注册

```go
gbl.Get("/items", listItems)               // GET
gbl.Post("/items", createItem)             // POST（按 Content-Type 读 body）
gbl.Put("/items/:id", replaceItem)         // PUT（读 body）
gbl.Patch("/items/:id", updateItem)        // PATCH（读 body）
gbl.Delete("/items/:id", deleteItem)       // DELETE（不读 body，仅路径/query）
gbl.Head("/items", headItems)              // HEAD（可选，见下）
gbl.Options("/items", myOptions)           // OPTIONS（可选，见下）
```

注册只是排队；真正的校验、装配计划构建、路由树插入都发生在 `Run()` 时。

### 同一 handler 挂多个动词

没有多动词合并注册的 API——每个动词各调一次，各占一条可路由规则：

```go
gbl.Get("/multi", multiHandler)
gbl.Post("/multi", multiHandler)
gbl.Put("/multi", multiHandler)
```

## 路径语法

路径是 `/` 分隔的段。每段要么是字面量，要么是变量——**两种写法等价**：

```go
gbl.Get("/user/:id", func(id string) string { return id })   // 冒号式
gbl.Get("/user/{id}", func(id string) string { return id })  // 花括号式
```

语法规则（违反即启动失败，原因先落日志）：

- 变量标记必须在**段首**且只出现一次：`::`、`{{`、`a:b`、`a{b` 都非法；
- 变量名不能为空：`/:`、`/{}` 非法；
- 空路径与单独的 `/` 不能注册；
- 路径首尾空白会被修剪，连续斜杠产生的空段会被跳过（`/a//b` 规范化为 `/a/b`）。

> 变量匹配**恰好一个段**，没有 catch-all 通配符。`/files/:path` 匹配 `/files/a` 但不匹配 `/files/a/b`。需要更深的结构就多注册几段。

## 匹配优先级：静态优先 + 回溯

每个 HTTP 动词同时维护**静态路由 map** 和**动态路由树**。请求到来时：

1. 先用原始路径 O(1) 直查静态 map，命中立即返回，不分配路径参数；
2. 未命中且存在静态路由时，才检查连续斜杠/尾部斜杠；需要归一化就归一化后再查一次静态 map；
3. 仍未命中才进入动态树，按段匹配并填充路径参数。

动态树内**每一层都先试静态子节点，失败再试变量子节点**，变量分支走死会回溯并清理已记录的路径参数。请求路径的 `/a//b` 与 `/a/b/` 因此能和注册后的 `/a/b` 命中同一规则：

```go
gbl.Get("/user/:id", func(id string) string { return "var:" + id })
gbl.Get("/user/new", func() string { return "static" })

// GET /user/new → "static"（静态赢）
// GET /user/42  → "var:42"
```

回溯的例子：

```go
gbl.Get("/a/:x/end", func(x string) string { return "x=" + x })
gbl.Get("/a/b/other", func() string { return "other" })

// GET /a/b/other：先走静态 b，命中 other ✓
// GET /a/b/end：  静态 b 走死，回溯到变量 :x，x="b" ✓
```

## 路由冲突：启动即失败

两种歧义会在启动时被拒绝（先落日志再 panic）：

```go
// 重复的具体路由
gbl.Get("/dup", h1)
gbl.Get("/dup", h2) // ✗ static route already exists

// 结构等价的变量路由（同位置不同名，匹配行为完全相同）
gbl.Get("/v/:a", h1)
gbl.Get("/v/:b", h2) // ✗ variable route conflicts
```

同名变量在同位置复用是允许的（共享节点），只要终端不重复注册。

## HEAD 自动兜底

注册 `Head` 是可选的：某路径**没有注册** HEAD 时，自动复用同路径的 GET 规则——handler 正常执行，`net/http` 丢弃 body 但保留 header 与 `Content-Length`：

```go
gbl.Get("/health", func() string { return "ok" })

// HEAD /health → 200 OK，Content-Length: 2，无 body
```

## OPTIONS 自动兜底

某路径**没有注册** OPTIONS 时，框架以 `204 No Content` + `Allow` 头（列出该路径实际支持的方法）自动应答；注册了 handler 就由你接管：

```go
gbl.Post("/items", createItem)

// OPTIONS /items → 204，Allow: POST

gbl.Options("/items", func(w http.ResponseWriter) {
    w.Header().Set("Allow", "POST, OPTIONS")
    w.WriteHeader(http.StatusNoContent)
})
// 此后 OPTIONS /items 由你的 handler 应答
```

## 未匹配时的三种回答

| 情况 | 回答 |
|---|---|
| 路径在任何动词下都不存在 | `404 Not Found` |
| 路径存在，但当前动词没注册 | `405 Method Not Allowed` + `Allow` 头 |
| 动词本身不被实现（TRACE、CONNECT、自定义动词） | `501 Not Implemented` |

`Allow` 头的计算会探测所有动词的静态 map 与动态树，并且**把 HEAD 算进去**（只要 GET 存在）——与 `serveHTTP` 实际接受的方法一致：

```go
gbl.Get("/res", h)
gbl.Post("/res", h)

// PUT /res → 405，Allow: GET, HEAD, POST
```

## 完整示例：资源路由

```go
func main() {
    gbl.Get("/articles", listArticles)          // 列表
    gbl.Get("/articles/:id", getArticle)        // 详情（:id 自动装配）
    gbl.Post("/articles", createArticle)        // 创建（JSON body）
    gbl.Put("/articles/:id", replaceArticle)    // 全量更新
    gbl.Patch("/articles/:id", patchArticle)    // 部分更新
    gbl.Delete("/articles/:id", deleteArticle)  // 删除（不读 body）

    // HEAD /articles 与 OPTIONS /articles 自动兜底，无需注册
    gbl.Run()
}
```

下一章：[路由分组](/docs/groups)——前缀与作用域中间件。