# 参数校验

```go
type Validatable interface {
    Validate() error
}
```

任何被装配的**业务参数**（含指针），只要其类型实现了 `Validate() error`，就会被自动校验，时机是**装配之后、handler 之前**。没实现的类型零开销。nil 指针直接传给 handler，不调用 `Validate`。

## 基本用法

```go
type Signup struct {
    Email string
    Age   int
    Name  string
}

// 每个类型只写一个 Validate——所有字段的规则都在这一个方法里。
// gbl 不强加任何自己的规则：用纯 Go，或调你自己的校验库。
func (s Signup) Validate() error {
    if s.Email == "" {
        return errors.New("email is required")
    }
    if s.Age < 18 {
        return errors.New("must be 18 or older")
    }
    if len(s.Name) > 32 {
        return errors.New("name is too long")
    }
    return nil
}

// handler 无需判空；Validate 返回非 nil 错误即 400，错误文本原样回显
gbl.Post("/signup", func(s Signup) string {
    return "signed up: " + s.Email
})
```

> `Signup` 的字段同样必须导出（大写开头）：JSON 装配会静默跳过小写字段，校验拿到的就只是零值。

## 失败时的行为

- 非 nil 错误以 **400** 中断请求，handler 不会执行；
- 错误文本**原样作为响应体**——消息是你自己写的，回显与否的所有权在你：想给客户端看什么就写什么，敏感内容别写进 `Validate`；
- 多个业务参数都实现了 `Validatable` 时，按参数顺序校验，**第一个失败即返回**。

## 值接收者与指针接收者都支持

`Validate` 声明在值接收者或指针接收者上都能被触发——GBL 先试值本身，再试它的地址：

```go
// 指针接收者同样生效，即使 handler 参数是值类型
func (s *Signup) Validate() error { ... }

gbl.Post("/signup", func(s Signup) string { ... })  // ✓ 会校验
gbl.Post("/signup2", func(s *Signup) string { ... }) // ✓ 也会校验
```

## 缺失 JSON 成员使用零值

多业务参数 JSON 模式下，缺少顶层成员不会单独触发 400。GBL 先创建该参数类型的零值，再执行 `Validatable`，最后调用 handler：

```go
type Draft struct {
    Title string
}

func (d *Draft) Validate() error {
    if d.Title == "" {
        return errors.New("title is required")
    }
    return nil
}

// Body: {"publish": true}，缺少 draft
gbl.Post("/draft", func(draft Draft, publish bool) string {
    return fmt.Sprintf("%s publish=%v", draft.Title, publish)
})
```

上例中 `draft` 是零值 `Draft{}`，指针接收者的 `Validate` 仍会执行并返回 400。若不实现 `Validatable`，handler 收到零值并自行决定是否允许。指针参数缺失时保持 nil，不调用 `Validate`。

JSON body 本身仍必须是对象；数组、`null`、非法 JSON 和类型转换错误属于装配失败，返回通用 400。

## 注入类参数不参与校验

只有业务参数（按名字装配的那些）会被检查。`*Context`、`*http.Request`、`http.ResponseWriter`、`gbl.SSEWriter`、文件参数不携带客户端业务数据，跳过。

## 接入你自己的校验库

GBL 不绑定任何校验方案。`Validate` 里可以调第三方库（在你的应用模块里引入，不影响 GBL 的零依赖）：

```go
func (s Signup) Validate() error {
    // 示例：调用你项目里已有的校验器
    return appvalidator.Struct(s)
}
```

## 与装配错误的区别

| 阶段 | 结果 | 客户端 | 日志 |
|---|---|---|---|
| 装配 | 缺 JSON 成员 | 使用零值，不中断 | — |
| 装配 | JSON 非对象 / 类型转换失败 | 通用 400 | 反射细节（参数名、Go 类型、strconv 详情） |
| 校验 | `Validate` 返回错误 | 400 + **错误文本原样** | — |

装配错误由框架从反射内部拼出，可能带内部标识，所以只回通用 400、细节进日志；校验消息是开发者亲手写的，披露责任在你，故原样到达客户端。

下一章：[SSE 实时流](/docs/sse)——发送事件、心跳与生命周期回调。