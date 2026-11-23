# Handler 与参数装配

这是 GBL 的核心。一句话：**handler 就是任意 `func`，GBL 读取它的签名，按「类型 + 名字」装配每个参数，再把返回值序列化出去。** 写业务逻辑的手感完全不变。

## handler 的约束

注册时（实际在 `Run()` 的 `generateRoute` 阶段）校验，违反即启动失败：

- 必须是非 nil 的函数；
- **最多一个返回值**（多返回值启动即报错）；
- **不支持变参函数**（`func(xs ...string)` 会被拒绝）。

```go
gbl.Get("/ok", func() string { return "ok" })      // ✓
gbl.Get("/ok2", func() {})                          // ✓ 无返回值 → 空 body
gbl.Get("/bad", func() (string, error) { ... })     // ✗ 启动失败：最多一个返回值
```

## 可注入的参数类型

每个参数在启动时被分入五类之一，请求期不再做类型判断：

| 参数类型 | GBL 注入什么 |
|---|---|
| `*gbl.Context` | 请求上下文（也是中间件的入参） |
| `*http.Request` | 原始请求 |
| `http.ResponseWriter`（或满足该接口的类型） | 框架包装后的响应写入器，完全接管响应 |
| `multipart.FileHeader` / `*multipart.FileHeader` / `[]multipart.FileHeader` / `[]*multipart.FileHeader` | 按字段名匹配到的上传文件 |
| 其他任意类型 | 按名字装配的**业务值**（见下） |

注入类参数不触发 body 解析——一个只声明 `*http.Request` 的 handler，请求 body 完全不会被读取。

## 业务值的装配来源与优先级

对每个业务参数：

**第一步：先查同名路径参数，命中就直接用。** 路径段优先于一切。

**第二步：没命中路径时，取值来源由 `Content-Type` 二选一（不是级联回退）：**

- **JSON 模式**：`application/json`（含 `+json` 后缀，如 `application/vnd.api+json`）且 body 非空白 → 只从 JSON body 取，form/query 一律不看。声明了 JSON 却发空 body 不回退——直接 **400**（`JSON body is empty` 原样回显）。
- **form/query 模式**：其他所有情况 → 从 form/query 值取。`POST`/`PUT`/`PATCH` 下，body 字段与同名 query 都能绑定，**body 优先**。

gbl 自己的名字查找一律**精确匹配**：路径/form/query 的 key、或顶层 JSON 成员，都按原样匹配，不做大小写折叠。（JSON body 内部的结构体字段由 `encoding/json` 解码，它按字段名忽略大小写匹配——这是唯一的例外。）

```go
// GET /user/42?verbose=true
// id 来自 :id 路径段（路径赢），verbose 来自 query
gbl.Get("/user/:id", func(id string, verbose bool) string {
    return fmt.Sprintf("user %s verbose=%v", id, verbose)
})
```

### 方法决定 body 是否被读取

`POST`/`PUT`/`PATCH` 按 `Content-Type` 读取并装配 body；`GET`/`HEAD`/`DELETE`/`OPTIONS` **从不读 body**——客户端就算塞了 body 也会被丢弃，只有路径和 query 参数会装配。

```go
// DELETE /items/7?hard=true（body 会被忽略）
gbl.Delete("/items/:id", func(id string, hard bool) string {
    return fmt.Sprintf("delete %s hard=%v", id, hard)
})
```

## JSON 模式的三条规则

> 前提：结构体字段必须导出（大写开头）。JSON 绑定走 `encoding/json`，只给导出字段赋值；未导出字段被静默忽略、保持零值且不报错。form/query 模式的结构体装配同样只认导出字段。

### 规则 1：单个业务参数 ← 整块 body

只有一个业务参数时，整个 JSON body 一次性解入该参数——**不限于结构体**，标量、切片、map 都可以：

```go
// POST /user · Body: {"id": 1, "name": "ada"}
gbl.Post("/user", func(u User) *User {
    return &u // 整个 body 解入 u
})

// POST /sum · Body: [1, 2, 3]
gbl.Post("/sum", func(nums []int) int {
    total := 0
    for _, n := range nums { total += n }
    return total // 6
})
```

### 规则 2：多个业务参数 ← 按形参名拆分顶层成员

JSON body + 多个业务参数时，body 必须是 JSON 对象，**每个非路径参数都要有一个与其形参同名的顶层成员**：

```go
// POST /user · Body: {"u": {"id": 1, "name": "ada"}, "verbose": true}
gbl.Post("/user", func(u User, verbose bool) string {
    return fmt.Sprintf("%s verbose=%v", u.Name, verbose)
})
```

缺一个顶层成员就是请求期 **400**（通用文本；缺哪个成员等细节只进服务端日志），而不是静悄悄给零值。body 不是对象（如数组）同样 400。

### 规则 3：路径参数依然优先

即使走 JSON 模式，同名路径参数仍然先命中：

```go
// POST /user/42 · Body: {"id": 99, "verbose": true}
gbl.Post("/user/:id", func(id int, verbose bool) string {
    // id == 42（路径赢），verbose == true（body 成员）
    return fmt.Sprintf("%d %v", id, verbose)
})
```

## form/query 模式的结构体装配

结构体参数在 form/query 模式下**按绑定名**填充。绑定名在注册期确定并缓存；请求 key **逐字节精确匹配**，不做大小写折叠，也绝不转换请求数据本身：

- **写了 json tag**：按 tag 名原样绑定（`json:"user_name"` 就绑 `user_name`）；
- **没写 json tag**：字段名首字母转小写（`Name` → `name`、`Id` → `id`），于是小写请求 key 无需任何 tag 即可绑定导出字段；
- `json:"-"` 的字段整个跳过；`json:"-,"` 表示字段名就叫 `-`。

> **驼峰约定**：字段应命名为 `Id` 而非 `ID`——只转首字母，`ID` 会派生出 `iD`，请求 key `id` 就绑不上了。

每个字段的取值优先级：先查同名路径参数，再查 form/query 值；嵌套结构体递归同样规则；`*struct` 即使没有同名来源也会被分配（零值），好让它的字段逐个绑定。

```go
type User struct {
    Id   int    // 无 tag → 绑定名 id
    Name string // 无 tag → 绑定名 name
}

// GET /user/42?name=ada → u.Id == 42（来自 :id），u.Name == "ada"
gbl.Get("/user/:id", func(u User) string {
    return fmt.Sprintf("%d %s", u.Id, u.Name)
})

type Tagged struct {
    Name string `json:"user_name"` // 有 tag → 绑定名 user_name 原样
}

// POST /t · form body: user_name=ada → t.Name == "ada"
gbl.Post("/t", func(t Tagged) string { return t.Name })
```

> JSON 模式下不会这样跨填——单个结构体参数只能来自 body（规则 1）；body 内部的结构体字段由 `encoding/json` 解码（那里的字段匹配忽略大小写，同样认 json tag）。

## 标量与复合类型的转换表

form/query 与路径参数都是字符串，GBL 按目标类型转换：

| 目标类型 | 转换规则 |
|---|---|
| `string` | 原样 |
| `bool` | `strconv.ParseBool`（`1/t/T/TRUE/true/True` 等） |
| `int` / `int8` / `int16` / `int32` / `int64` | 十进制解析，按位宽校验溢出 |
| `uint` / `uint8` / `uint16` / `uint32` / `uint64` / `uintptr` | 十进制解析 |
| `float32` / `float64` | `strconv.ParseFloat` |
| `complex64` / `complex128` | `strconv.ParseComplex`（如 `1+2i`） |
| 指针（`*int` 等） | 来源缺失 → `nil`；存在 → 指向转换后的值 |
| 切片（`[]int` 等） | 消费**重复值**（`?tag=a&tag=b`）；缺失 → 空切片 |
| `[]byte` | 特殊：取第一个值的原始字节，不是重复值 |
| 数组（`[3]int`） | 重复值数量**必须恰好等于数组长度**，否则 400 |
| 结构体 | 按绑定名递归（见上） |

```go
// GET /filter?tag=go&tag=web&limit=10&ratio=0.5&debug=true
gbl.Get("/filter", func(tag []string, limit int, ratio float64, debug bool) string {
    return fmt.Sprintf("%v %d %.1f %v", tag, limit, ratio, debug)
})

// GET /point?z=1+2i
gbl.Get("/point", func(z complex128) string {
    return fmt.Sprintf("%v", z) // (1+2i)
})

// 可选参数：缺失即 nil
gbl.Get("/maybe", func(p *int) string {
    if p == nil { return "absent" }
    return strconv.Itoa(*p)
})
```

标量参数取**第一个值**；要消费重复值请用切片或数组。转换失败（如 `limit=abc`）→ 通用 400，参数名与原因只进服务端日志。

## 返回值自动序列化

Content-Type 在**注册时**就根据返回值的静态类型选好：

| 返回类型 | Content-Type | body |
|---|---|---|
| `string` | `text/plain; charset=utf-8` | 原样 |
| `[]byte` | `text/plain; charset=utf-8` | 原始字节 |
| `bool` / 整数 / 无符号 / 浮点 / 复数 | `text/plain; charset=utf-8` | 格式化文本（`42`、`true`、`3.14`） |
| 结构体 / map / 数组 / 非字节切片 / 指针 / 接口 | `application/json; charset=utf-8` | JSON |
| nil 指针 / nil 接口 | `application/json; charset=utf-8` | **空 body** |
| 无返回值 | — | 空 body，200 |

```go
gbl.Get("/text", func() string { return "plain" })
gbl.Get("/num", func() int { return 42 })                       // "42"
gbl.Get("/json", func() map[string]int { return map[string]int{"n": 3} })
gbl.Get("/obj", func() *User { return &User{Id: 1} })           // {"Id":1,...}
gbl.Get("/none", func() {})                                     // 空 body
gbl.Get("/nil", func() *User { return nil })                    // 空 body
```

序列化失败（如返回了含 channel 的结构体）是服务端错误：固定文本 `response serialization failed` + 500，不泄漏内部细节。

## 想要原始读写时

声明 `http.ResponseWriter` 或 `*http.Request` 即可完全接管：

```go
gbl.Get("/raw", func(w http.ResponseWriter) {
    w.WriteHeader(http.StatusCreated)
    _, _ = w.Write([]byte("direct"))
})

gbl.Post("/echo", func(r *http.Request) string {
    return r.Header.Get("X-Trace-Id")
})
```

一旦写过 body（无论 handler 还是中间件），框架就不再写暂存结果——以你写的为准。

## 参数名从哪来

Go 的反射只能拿到参数**类型**，拿不到**名字**。GBL 在启动时依次从两处恢复形参名：handler 所在的源码文件（AST，开发期路径），然后是二进制自带的 **DWARF** 调试信息（无源码的生产路径）——闭包也能正确解析。

这只带来一个构建约束：`-ldflags "-w"/"-s"` 会剥除 DWARF，此时按名字绑定的 handler 会**启动失败**并给出明确修复指引；普通构建（含 `-trimpath`、只拷贝二进制的镜像）直接可用。单个结构体参数不受影响（字段名来自反射）。详见[部署与构建](/docs/deployment)。

未命名的形参（`func(string) string`）会得到占位名 `arg0`、`arg1`……请求里恰好有同名 key 也能匹配，但请始终给参数命名。

## 装配失败的响应策略

| 失败 | 状态码 | 客户端看到 |
|---|---|---|
| 参数缺失（多参数 JSON）/ 转换失败 | 400 | 通用 `Bad Request`（参数名、Go 类型等反射细节只进日志） |
| body 超过总限额 | 413 | `Request Entity Too Large` |
| 校验失败（`Validatable`） | 400 | `Validate` 错误文本原样回显（消息是你写的，披露责任在你） |
| 返回值序列化失败 | 500 | 固定文本（服务端问题，不泄漏） |

## 完整示例：一个订单接口

```go
type OrderQuery struct {
    Status string
    Limit  int
}

// GET /orders?status=paid&limit=20
// 结构体按绑定名（首字母小写）从 query 装配，Limit 自动转 int
gbl.Get("/orders", func(q OrderQuery) []Order {
    return loadOrders(q.Status, q.Limit)
})

// POST /orders · JSON body 整体解入 Order
// Order 实现了 Validate() → 装配后自动校验（见「参数校验」章）
gbl.Post("/orders", func(o Order) Order {
    o.ID = newID()
    save(o)
    return o
})
```

下一章：[路由](/docs/routing)——路径语法、匹配优先级与自动兜底。