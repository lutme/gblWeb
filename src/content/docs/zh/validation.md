# 参数校验

```go
type Validatable interface {
    Validate() error
}
```

任何被装配的**业务参数**（含指针），只要其类型实现了 `Validate() error`，就会被自动校验，时机是**装配之后、handler 之前**。没实现的类型零开销。

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

// handler 无需判空；Validate 返回非 nil 错误即得通用 400
gbl.Post("/signup", func(s Signup) string {
    return "signed up: " + s.Email
})
```

> `Signup` 的字段同样必须导出（大写开头）：JSON 装配会静默跳过小写字段，校验拿到的就只是零值。

## 失败时的行为

- 非 nil 错误以**通用 400** 中断请求，handler 不会执行；
- 错误文本**只写进服务端日志**（`request validation failed` + error 字段），绝不回显给客户端——所以 `Validate` 里可以放心描述内部规则；
- 多个业务参数都实现了 `Validatable` 时，按参数顺序校验，**第一个失败即返回**。

## 值接收者与指针接收者都支持

`Validate` 声明在值接收者或指针接收者上都能被触发——GBL 先试值本身，再试它的地址：

```go
// 指针接收者同样生效，即使 handler 参数是值类型
func (s *Signup) Validate() error { ... }

gbl.Post("/signup", func(s Signup) string { ... })  // ✓ 会校验
gbl.Post("/signup2", func(s *Signup) string { ... }) // ✓ 也会校验
```

## 注入类参数不参与校验

只有业务参数（按名字装配的那些）会被检查。`*Context`、`*http.Request`、`http.ResponseWriter`、文件参数不携带客户端业务数据，跳过。

## 接入你自己的校验库

GBL 不绑定任何校验方案。`Validate` 里可以调第三方库（在你的应用模块里引入，不影响 GBL 的零依赖）：

```go
func (s Signup) Validate() error {
    // 示例：调用你项目里已有的校验器
    return appvalidator.Struct(s)
}
```

## 与装配错误的区别

| 阶段 | 失败 | 客户端 | 日志 |
|---|---|---|---|
| 装配 | 缺字段 / 类型转换失败 / 非法 JSON | 400 + **具体原因** | — |
| 校验 | `Validate` 返回错误 | 400 **通用文本** | 完整错误 |

装配错误描述的是客户端自己的畸形输入，回显安全；校验错误可能暴露业务规则，所以只进日志。

下一章：[文件上传](/docs/uploads)。