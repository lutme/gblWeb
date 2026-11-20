# Getting Started

This chapter gets your first GBL server running in five minutes and walks through the complete path a request takes from arrival to response.

## Install

```bash
go get github.com/gblgo/gbl
```

GBL is zero-dependency: this step adds no indirect dependencies to your `go.mod`. Go 1.27+ is required.

## Your first server

Create `main.go`:

```go
package main

import "github.com/gblgo/gbl"

func main() {
    gbl.Get("/hello", func() string {
        return "hello, gbl"
    })

    // Listens on :9801 by default; Ctrl+C / SIGTERM triggers graceful shutdown
    gbl.Run()
}
```

Run it:

```bash
go run .
```

On startup you will see GBL's banner, the status table, and a final startup-success line:

```text
  ┏━╸  ┏┓   ╻
  ┃╺┓  ┣┻┓  ┃      zero-dependency Go web framework
  ┗━┛  ┗━┛  ┗━╸

  version    (devel)
  listening  http://localhost:9801
  tls        disabled
  routes     1

2026/11/15 10:00:00 INFO started successfully, ready to accept requests
```

> `version` comes from the build info: `go run` or an untagged local build shows `(devel)`, a tagged build shows the real version. `listening` renders wildcard binds such as `0.0.0.0` / `::` as `localhost` so the URL is clickable. The banner block prints verbatim without prefixes; the success line is an ordinary Info record carrying timestamp and level.

Verify:

```bash
curl http://localhost:9801/hello
# hello, gbl
```

## Add parameters and JSON

Signature binding is GBL's core capability. Extend `main.go` to:

```go
package main

import (
    "fmt"
    "strings"

    "github.com/gblgo/gbl"
)

type User struct {
    ID   int
    Name string
}

func main() {
    // Path parameter: :id is bound to the parameter named id
    gbl.Get("/user/:id", func(id string) string {
        return "user " + id
    })

    // Query parameters: bound by name, converted to int automatically
    gbl.Get("/search", func(keyword string, limit int) string {
        return fmt.Sprintf("%s (limit=%d)", keyword, limit)
    })

    // JSON body: a single struct parameter ← the whole body
    gbl.Post("/user", func(u User) *User {
        u.Name = strings.ToUpper(u.Name)
        return &u
    })

    gbl.Run()
}
```

> Struct fields must be exported (capitalized): JSON binding uses `encoding/json`, which only sets exported fields; lowercase fields are silently ignored, stay zero, and raise no error. Response serialization behaves the same.

Verify each one:

```bash
curl http://localhost:9801/user/42
# user 42

curl "http://localhost:9801/search?keyword=gbl&limit=5"
# gbl (limit=5)

curl -X POST http://localhost:9801/user \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "name": "ada"}'
# {"ID":1,"Name":"ADA"}
```

Look at the third request: you wrote no decoding code at all. `User` is bound from the body automatically, the returned `*User` becomes JSON automatically, and the `Content-Type` was chosen at registration time from the return type.

## Optional configuration: Configure

Without configuration everything uses defaults. To change the port, enable TLS or tune timeouts, override them in code before `Run`:

```go
gbl.Configure(func(c *gbl.Config) {
    c.Name = "myapp"
    c.Port = "9802"

    // HTTPS is enabled when CertFile and KeyFile are both present
    c.CertFile = "server.crt"
    c.KeyFile  = "server.key"

    c.ReadTimeout  = 10 * time.Second
    c.WriteTimeout = 10 * time.Second
})
```

The kernel reads no configuration file — configuration lives entirely in code. The full field table is in [Configuration](/docs/configuration).

## The complete journey of a request

Take `GET /user/42`. Inside GBL, in order:

```text
Request arrives
  │
  ▼
net/http accepts the connection and parses the request
  │
  ▼
(If CORS is configured) corsHandler checks the Origin
  │
  ▼
Method resolution + routing-tree match, path parameters filled: {id: "42"}
  │
  ▼
A Context is taken from the pool, loaded with the request,
path parameters and this route's frozen middleware chain
  │
  ▼
c.Next() drives the onion chain:
  global middleware → group middleware → routeEndpoint
  │
  ▼
routeEndpoint calls invokeHandler:
  parse request → bind parameters per the bind plan → validate
  → invoke handler via reflection → stash the serialized result
  │
  ▼
The chain unwinds (code after c.Next() in middleware runs)
  │
  ▼
The stashed result is written back (Content-Type chosen at registration)
  │
  ▼
Multipart temp files cleaned up; Context and friends reset and returned to their pools
```

Two things worth remembering:

1. **The middleware chain is frozen at startup.** Only `Run()` assembles global middleware, group middleware and the terminal `routeEndpoint` into a fixed slice per route; requests reuse it directly, nothing is reassembled per request.
2. **The response is written back only after the chain fully unwinds.** That is why middleware code after `c.Next()` can read the final status code, response size and handler return value — timing and access logs belong in this phase.

Details in [Middleware](/docs/middleware) and [Context](/docs/context).

## Graceful shutdown

`gbl.Run()` handles signals out of the box: on `SIGINT` (Ctrl+C) or `SIGTERM` it closes the listener, gives in-flight requests a 5-second window to finish, then exits. To stop the server from code (health-check switches, tests, embedding), use `gbl.Shutdown(ctx)` — see [Lifecycle](/docs/lifecycle).

## Next steps

- All binding rules and edge cases: [Handlers & Parameter Binding](/docs/handlers)
- Path syntax and match priority: [Routing](/docs/routing)
- Organizing your API: [Route Groups](/docs/groups)
- Cross-cutting concerns (auth, logging, timing): [Middleware](/docs/middleware)