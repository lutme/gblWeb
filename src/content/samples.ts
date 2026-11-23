export const helloCode = `package main

import "github.com/gblgo/gbl"

func main() {
    gbl.Get("/hello", func() string {
        return "hello, gbl"
    })

    // Listens on :9801 by default; Ctrl+C / SIGTERM
    // triggers graceful shutdown.
    gbl.Run()
}`

export const installCode = `go get github.com/gblgo/gbl`

export const runCode = `go run .
# GET http://localhost:9801/hello  ->  hello, gbl`

export const configureCode = `gbl.Configure(func(c *gbl.Config) {
    c.Port = "9802"

    // TLS is enabled when both CertFile and KeyFile are set
    c.CertFile = "server.crt"
    c.KeyFile  = "server.key"

    c.ReadTimeout  = 10 * time.Second
    c.WriteTimeout = 10 * time.Second
})`

export const crudCode = `package main

import (
    "strconv"
    "sync"

    "github.com/gblgo/gbl"
)

// Fields must be exported (capitalized): encoding/json ignores unexported fields.
type Item struct {
    ID   int
    Name string
}

var (
    mu     sync.Mutex
    items  = map[int]Item{}
    nextID = 1
)

func main() {
    api := gbl.Group("/api")

    api.Get("/items", func() []Item {
        mu.Lock()
        defer mu.Unlock()
        list := make([]Item, 0, len(items))
        for _, it := range items {
            list = append(list, it)
        }
        return list // []Item -> JSON array
    })

    api.Get("/items/:id", func(id int) Item {
        mu.Lock()
        defer mu.Unlock()
        return items[id] // :id binds to the int param
    })

    api.Post("/items", func(it Item) Item {
        mu.Lock()
        defer mu.Unlock()
        it.ID = nextID // whole JSON body decodes into it
        nextID++
        items[it.ID] = it
        return it
    })

    api.Delete("/items/:id", func(id int) string {
        mu.Lock()
        defer mu.Unlock()
        delete(items, id)
        return "deleted " + strconv.Itoa(id)
    })

    gbl.Run()
}`

export const authCode = `// Auth is cross-cutting: parse the token once in a middleware,
// then every handler just reads the current user.
gbl.Use(func(c *gbl.Context) {
    uid, ok := parseToken(c.Request.Header.Get("Authorization"))
    if !ok {
        c.AbortWithStatusJSON(http.StatusUnauthorized,
            map[string]string{"error": "unauthorized"})
        return
    }
    c.Set("uid", uid)
    c.Next()
})

// The handler never touches the token.
gbl.Get("/orders", func(c *gbl.Context) []Order {
    uid := c.Value[int64]("uid")
    return loadOrders(uid)
})`

export const uploadCode = `// Raise the per-file cap (default 1 MiB) to 5 MiB.
gbl.SetMaxUploadFileSize(gbl.ByteSize(5 << 20))

// Single file: field "avatar" matches the parameter name.
gbl.Post("/upload", func(avatar *multipart.FileHeader) string {
    if avatar == nil {
        return "no file" // missing upload -> nil, never a panic
    }
    return fmt.Sprintf("%s (%d bytes)", avatar.Filename, avatar.Size)
})

// Multiple files under one field.
gbl.Post("/gallery", func(photos []*multipart.FileHeader) string {
    return fmt.Sprintf("%d files uploaded", len(photos))
})`

export const envelopeCode = `// Once registered, the processor owns rendering of EVERY
// recovered value — explicit aborts and real crashes alike.
// Never echo the internal err into the body.
gbl.RegisterPanicProcessor(func(err any) (any, gbl.HttpStatus) {
    return map[string]any{
        "code":    500,
        "message": "internal error",
    }, gbl.HttpStatus(500)
})

// Explicit aborts still reach the client by design:
gbl.Get("/admin", func(c *gbl.Context) {
    if !isAdmin(c) {
        c.AbortWithStatusString(http.StatusForbidden, "forbidden")
        return
    }
})`

export const middlewareCode = `gbl.Use(func(c *gbl.Context) {
    // ── request phase ──
    start := time.Now()
    c.Set("requestID", newRequestID())

    c.Next() // runs all downstream links + handler

    // ── response phase: result & status are final ──
    log.Printf("%s %s -> %d (%s)",
        c.Request.Method, c.Request.URL.Path,
        c.StatusCode(), time.Since(start))
})

// Access log is yours: not built in, one middleware line via the engine Logger.
gbl.Use(func(c *gbl.Context) {
    c.Next()
    gbl.Info("access", "method", c.Request.Method, "path", c.Request.URL.Path,
        "status", c.StatusCode(), "size", c.Size())
})`

export interface Scenario {
  id: 'path' | 'json' | 'form' | 'upload' | 'returns'
  code: string
  request: string
  response: string
}

export const scenarios: Scenario[] = [
  {
    id: 'path',
    code: `gbl.Get("/user/:id", func(id string) string {
    return "user " + id
})`,
    request: `GET /user/42 HTTP/1.1
Host: localhost:9801`,
    response: `HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8

user 42`,
  },
  {
    id: 'json',
    code: `gbl.Post("/user", func(u User) *User {
    u.Name = strings.ToUpper(u.Name)
    return &u
})`,
    request: `POST /user HTTP/1.1
Content-Type: application/json

{"id": 1, "name": "ada"}`,
    response: `HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"ID":1,"Name":"ADA"}`,
  },
  {
    id: 'form',
    code: `gbl.Get("/search", func(keyword string, limit int) string {
    return fmt.Sprintf("%s:%d", keyword, limit)
})`,
    request: `GET /search?keyword=gbl&limit=5 HTTP/1.1
Host: localhost:9801`,
    response: `HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8

gbl:5`,
  },
  {
    id: 'upload',
    code: `gbl.Post("/upload", func(avatar *multipart.FileHeader) string {
    return fmt.Sprintf("%s (%d bytes)",
        avatar.Filename, avatar.Size)
})`,
    request: `POST /upload HTTP/1.1
Content-Type: multipart/form-data; boundary=X

--X
Content-Disposition: form-data; name="avatar";
  filename="photo.png"

<24576 bytes>
--X--`,
    response: `HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8

photo.png (24576 bytes)`,
  },
  {
    id: 'returns',
    code: `gbl.Get("/stats", func() map[string]int {
    return map[string]int{"routes": 7}
})`,
    request: `GET /stats HTTP/1.1
Host: localhost:9801`,
    response: `HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"routes":7}`,
  },
]