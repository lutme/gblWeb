# Configuration

At startup GBL reads the `[gbl]` section of `application.ini` in the **working directory**; **no file means all defaults**. Keys accept both `camelCase` and `kebab-case`.

## A complete example

```ini
[gbl]
name       = myapp
port       = 9801
# TLS is enabled when certFile and keyFile are both present
certFile   = server.crt
keyFile    = server.key
readTimeout       = 10s
readHeaderTimeout = 5s
writeTimeout      = 10s
idleTimeout       = 60s

# File logging (empty = file logging off, console only)
logDir  = ./logs
# logFile = ./app.log
# infoLog  = ./logs/info.log
# warnLog  = ./logs/warn.log
# errorLog = ./logs/error.log
```

## Key table

| Key | Default | Meaning |
|---|---|---|
| `name` | `gbl` | application name |
| `port` | `9801` | listening port |
| `certFile` / `keyFile` | empty | both present ⇒ HTTPS enabled; only one does nothing |
| `readTimeout` | `10s` | maximum time to read the whole request |
| `readHeaderTimeout` | `5s` | maximum time to read request headers |
| `writeTimeout` | `10s` | maximum time to write the whole response |
| `idleTimeout` | `60s` | maximum idle wait on keep-alive connections |
| `logFile` | empty | merged log file (the coarsest destination) |
| `logDir` | empty | directory for the auto-named `info.log/warn.log/error.log` |
| `infoLog` / `warnLog` / `errorLog` | empty | explicit per-level paths, highest priority |

Duration values use Go's `time.ParseDuration` format: `5s`, `1m30s`, `500ms`. Invalid values (e.g. `port=abc`, `readTimeout=xx`) fail at startup, reason logged first.

## Snapshot semantics

- `application.ini` is **loaded exactly once** (on first access) and frozen into a process-wide snapshot;
- registration code can read configuration before `Run()` (see `IniBySection` below);
- a **missing** file is a normal empty configuration — all defaults;
- a file that **exists but is malformed** is a fatal error — reported on every read, never swallowed.

## Reading your own sections

GBL exposes its ini reader as a general configuration tool for your own sections:

### IniBySection / IniBySectionAndKey

Read the **frozen application.ini snapshot** (safe from any goroutine, callable before and after Run):

```go
// application.ini:
// [db]
// host = 127.0.0.1
// port = 5432

// Take a whole section (a copy is returned — mutate freely, internal config untouched)
if db, ok := gbl.IniBySection("db"); ok {
    dsn := fmt.Sprintf("host=%s port=%s", db["host"], db["port"])
    openDB(dsn)
}

// Take a single value
if port, ok := gbl.IniBySectionAndKey("db", "port"); ok {
    log.Println("db port", port)
}
```

### ReadIni

Parse a classic INI file at **any path** into `section -> key -> value`:

```go
func ReadIni(path string) (map[string]map[string]string, error)
```

```go
cfg, err := gbl.ReadIni("db.ini")
if errors.Is(err, os.ErrNotExist) {
    // no file — apply your own defaults
}
```

Parsing rules:

- blank lines and **whole-line comments** starting with `#` or `;` are skipped;
- **inline comments are not stripped** — values may contain `#`/`;` (`password = a#b` has the value `a#b`);
- `[section]` opens a group; `key = value` fills the current group, whitespace trimmed on both sides;
- a key before any section, an empty section name (`[]`), a line without `=`, or an empty key → parse error (with line number);
- a missing file is detectable with `errors.Is(err, os.ErrNotExist)`.

> **Division of labor**: `ReadIni` parses any path; `IniBySection` / `IniBySectionAndKey` read GBL's own `application.ini` snapshot.

## Full example: reading configuration at registration time

```go
func main() {
    // Readable before Run — the snapshot loads on first access
    if dsn, ok := gbl.IniBySectionAndKey("db", "dsn"); ok {
        connectDB(dsn)
    }

    gbl.Get("/health", func() string { return "ok" })
    gbl.Run()
}
```

Next: [Lifecycle](/docs/lifecycle).