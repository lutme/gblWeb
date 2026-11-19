# Configuration

The kernel **reads no configuration file**: defaults work out of the box, overrides live in code via `Configure`, and `Run` starts with whatever that configuration left. Configuration files (YAML, environment, profiles, config centers) are an integration-layer concern — the future gbl-boot will resolve those sources and call the same `Configure` entry point.

## Configure

```go
func Configure(fn func(*Config))
```

`fn` receives the configuration **already filled with defaults**, so it only assigns the fields it cares about. Call it before `Run`; passing nil is a no-op.

```go
gbl.Configure(func(c *gbl.Config) {
    c.Name = "myapp"
    c.Port = "8080"
    c.ReadTimeout = 5 * time.Second
})
```

## A complete example

```go
package main

import (
    "time"

    "github.com/gblgo/gbl"
)

func main() {
    gbl.Configure(func(c *gbl.Config) {
        c.Name = "myapp"
        c.Port = "9802"

        // TLS is enabled when both CertFile and KeyFile are set
        c.CertFile = "server.crt"
        c.KeyFile  = "server.key"

        c.ReadTimeout       = 10 * time.Second
        c.ReadHeaderTimeout = 5 * time.Second
        c.WriteTimeout      = 10 * time.Second
        c.IdleTimeout       = time.Minute
    })

    gbl.Get("/health", func() string { return "ok" })
    gbl.Run()
}
```

## Config fields and defaults

```go
type Config struct {
    Name              string        // application name
    Port              string        // listen port, without the leading colon
    CertFile          string        // TLS certificate file path
    KeyFile           string        // TLS private key file path
    ReadTimeout       time.Duration // max duration to read an entire request
    ReadHeaderTimeout time.Duration // max duration to read request headers
    WriteTimeout      time.Duration // max duration to write an entire response
    IdleTimeout       time.Duration // max idle wait before a keep-alive connection closes
}
```

| Field | Default | Meaning |
|---|---|---|
| `Name` | `gbl` | application name |
| `Port` | `9801` | listen port |
| `CertFile` / `KeyFile` | empty | both set ⇒ HTTPS enabled; only one does nothing |
| `ReadTimeout` | `10s` | max duration to read an entire request |
| `ReadHeaderTimeout` | `5s` | max duration to read request headers |
| `WriteTimeout` | `10s` | max duration to write an entire response |
| `IdleTimeout` | `60s` | max idle wait before a keep-alive connection closes |

The timeout fields are `time.Duration` values — write them the Go way: `5 * time.Second`, `90 * time.Second`, `time.Minute`.

## TLS is derived

`useTLS` is not set directly: after every `Configure` returns, the framework re-derives it from `CertFile != "" && KeyFile != ""`. Setting or clearing either path takes effect immediately — no separate switch.

Paths reach the standard library verbatim: **a relative path resolves against the process working directory at launch**, not the executable's directory. If the launch working directory is out of your control, build an absolute path inside `Configure`.

## Business configuration is yours

The kernel only manages server runtime parameters. Database connections, business flags and the like are the application's own business — resolve them in your code (environment, files, a config center, anything), and call `Configure` for the part that affects server parameters. For a ready-made file/environment configuration story, wait for the future gbl-boot integration layer.

Next: [Lifecycle](/docs/lifecycle).