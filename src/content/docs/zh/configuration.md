# 配置

启动时 GBL 读取**工作目录**下 `application.ini` 的 `[gbl]` 段；**不给文件即全用默认**。键名 `camelCase` 与 `kebab-case` 都接受。

## 完整示例

```ini
[gbl]
name       = myapp
port       = 9801
# certFile 与 keyFile 同时给出则启用 TLS
certFile   = server.crt
keyFile    = server.key
readTimeout       = 10s
readHeaderTimeout = 5s
writeTimeout      = 10s
idleTimeout       = 60s

# 文件日志（留空 = 关闭文件日志，仅控制台）
logDir  = ./logs
# logFile = ./app.log
# infoLog  = ./logs/info.log
# warnLog  = ./logs/warn.log
# errorLog = ./logs/error.log
```

## 键表

| 键 | 默认 | 含义 |
|---|---|---|
| `name` | `gbl` | 应用名 |
| `port` | `9801` | 监听端口 |
| `certFile` / `keyFile` | 空 | 两者都给 ⇒ 启用 HTTPS；只给一个不启用 |
| `readTimeout` | `10s` | 读取整个请求的最长时间 |
| `readHeaderTimeout` | `5s` | 读取请求头的最长时间 |
| `writeTimeout` | `10s` | 写出整个响应的最长时间 |
| `idleTimeout` | `60s` | keep-alive 连接的最长空闲等待 |
| `logFile` | 空 | 合并日志文件（最粗的目的地） |
| `logDir` | 空 | 存放自动命名的 `info.log/warn.log/error.log` 的目录 |
| `infoLog` / `warnLog` / `errorLog` | 空 | 显式逐级路径，优先级最高 |

时长值用 Go 的 `time.ParseDuration` 格式：`5s`、`1m30s`、`500ms`。非法值（如 `port=abc`、`readTimeout=xx`）启动即失败，原因先落日志。

## 快照语义

- `application.ini` **只加载一次**（首次访问时），冻结为进程级快照；
- 注册代码在 `Run()` 之前就能读配置（见下面的 `IniBySection`）；
- 文件**缺失**是正常的空配置，全用默认；
- 文件**存在但格式非法**是致命错误——每次读取都会报告，不会被吞掉。

## 读取你自己的段

GBL 把 ini 读取器作为通用配置工具暴露给你自己的段：

### IniBySection / IniBySectionAndKey

读取**已冻结的 application.ini 快照**（任意 goroutine 安全，Run 前后都能调）：

```go
// application.ini:
// [db]
// host = 127.0.0.1
// port = 5432

// 取整段（返回副本——可自由修改，不影响内部配置）
if db, ok := gbl.IniBySection("db"); ok {
    dsn := fmt.Sprintf("host=%s port=%s", db["host"], db["port"])
    openDB(dsn)
}

// 取单个值
if port, ok := gbl.IniBySectionAndKey("db", "port"); ok {
    log.Println("db port", port)
}
```

### ReadIni

解析**任意路径**的经典 INI 文件为 `section -> key -> value`：

```go
func ReadIni(path string) (map[string]map[string]string, error)
```

```go
cfg, err := gbl.ReadIni("db.ini")
if errors.Is(err, os.ErrNotExist) {
    // 没有文件——套用你自己的默认
}
```

解析规则：

- 空行与 `#` 或 `;` 开头的**整行注释**跳过；
- **不剥离行内注释**——值里可以含 `#`/`;`（`password = a#b` 的值就是 `a#b`）；
- `[section]` 开一组；`key = value` 填充当前组，键值两端空白被修剪；
- 某 key 出现在任何 section 之前、空 section 名（`[]`）、没有 `=` 的行、空键 → 解析错误（带行号）；
- 文件不存在的错误可用 `errors.Is(err, os.ErrNotExist)` 判断。

> **分工**：`ReadIni` 解析任意路径；`IniBySection` / `IniBySectionAndKey` 读 GBL 自己的 `application.ini` 快照。

## 完整示例：注册期读配置

```go
func main() {
    // Run 之前就能读——快照在首次访问时加载
    if dsn, ok := gbl.IniBySectionAndKey("db", "dsn"); ok {
        connectDB(dsn)
    }

    gbl.Get("/health", func() string { return "ok" })
    gbl.Run()
}
```

下一章：[服务生命周期](/docs/lifecycle)。