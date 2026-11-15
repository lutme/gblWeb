# 跨域 CORS

```go
func SetCorsConfig(cc *CorsConfig) // 传 nil 关闭 CORS
```

`SetCorsConfig` 在引擎上安装跨域策略，`Run` 随后用它包裹处理链——预检、来源/方法/头匹配、凭据与 max-age。

## CorsConfig

直接用普通结构体字面量构造，字段全部导出：

```go
type CorsConfig struct {
    AllowedOrigins   []string      // 允许的来源，或 "*"
    AllowedMethods   []string      // 允许跨域携带的 HTTP 方法
    AllowedHeaders   []string      // 预检中接受的请求头
    ExposedHeaders   []string      // 允许跨域客户端读取的响应头
    AllowCredentials bool          // 是否允许跨域携带凭据（cookie/认证）
    MaxAge           time.Duration // 客户端可缓存预检结果的时长
}
```

```go
gbl.SetCorsConfig(&gbl.CorsConfig{
    AllowedOrigins:   []string{"https://app.example.com"},
    AllowedMethods:   []string{http.MethodGet, http.MethodPost},
    AllowedHeaders:   []string{"Content-Type", "X-Trace-Id"},
    ExposedHeaders:   []string{"X-Total-Count"},
    AllowCredentials: true,
    MaxAge:           time.Hour,
})

// 任意站点都可读接口——但不带凭据：
gbl.SetCorsConfig(&gbl.CorsConfig{
    AllowedOrigins: []string{"*"},
    AllowedMethods: []string{http.MethodGet},
})

gbl.SetCorsConfig(nil) // 重新关闭 CORS
```

## 安全策略：危险组合启动即拦截

`AllowCredentials=true` 同时 `AllowedOrigins` 含通配 `"*"`，等于允许任意站点发起携带凭据的跨域请求——CORS 规范明确禁止。命中这条策略的配置在 **`SetCorsConfig` 调用时**就中止启动（先落日志再 panic），而不是运行时悄悄降级：

```go
// ✗ 启动失败：
gbl.SetCorsConfig(&gbl.CorsConfig{
    AllowedOrigins:   []string{"*"},
    AllowCredentials: true,
})
// 报错指明：列出允许发送凭据的具体来源，而不是通配符
```

## 请求处理流程

CORS 层包在引擎外面，按请求类型分流：

```text
请求带 Origin？
├─ 无 Origin（同源/非浏览器）→ 直接进引擎
├─ 预检（OPTIONS + Access-Control-Request-Method）
│   ├─ 来源不允许 → 403 "CORS origin not allowed"
│   ├─ 方法不在 AllowedMethods → 403 "CORS method not allowed"
│   ├─ 请求头不在 AllowedHeaders → 403 "CORS header not allowed"
│   └─ 通过 → 204 + Allow-Methods/Allow-Headers/Max-Age + Vary
└─ 实际请求
    ├─ 来源允许 → 加 Allow-Origin（+凭据/Expose-Headers）→ 进引擎
    └─ 来源不允许 → 不加 CORS 头，仍进引擎正常处理
```

最后一条值得理解：来源不允许的**非预检**请求不会被服务端拒绝——它照常处理，只是响应没有 CORS 头，**浏览器**会拦截 JS 读取。服务端拦截只发生在预检阶段。

## 匹配细节

- 来源/方法/头匹配均**忽略大小写**；
- 通配 `"*"` 时 `Access-Control-Allow-Origin` 回字面 `*`；允许列表命中时**原样回显**请求的 Origin；
- `Vary: Origin`（以及预检的 `Vary: Access-Control-Request-Method, Access-Control-Request-Headers`）自动添加，缓存友好；
- `MaxAge > 0` 时以秒数写入 `Access-Control-Max-Age`。

## 完整示例：前后端分离

```go
func main() {
    gbl.SetCorsConfig(&gbl.CorsConfig{
        AllowedOrigins:   []string{"https://app.example.com", "https://staging.example.com"},
        AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE"},
        AllowedHeaders:   []string{"Content-Type", "Authorization"},
        ExposedHeaders:   []string{"X-Total-Count", "X-Request-Id"},
        AllowCredentials: true,
        MaxAge:           12 * time.Hour,
    })

    api := gbl.Group("/api")
    api.Get("/items", listItems)
    api.Post("/items", createItem)

    gbl.Run()
}
```

下一章：[配置](/docs/configuration)。