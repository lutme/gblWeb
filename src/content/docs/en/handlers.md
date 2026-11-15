# Handlers & Parameter Binding

This is the heart of GBL. In one sentence: **a handler is any `func`; GBL reads its signature, binds every parameter by "type + name", and serializes the return value.** Writing business logic feels exactly the same as always.

## Handler constraints

Validated at registration time (actually during `generateRoute` inside `Run()`); violations fail startup:

- must be a non-nil function;
- **at most one return value** (multiple return values fail at startup);
- **variadic functions are not supported** (`func(xs ...string)` is rejected).

```go
gbl.Get("/ok", func() string { return "ok" })      // ✓
gbl.Get("/ok2", func() {})                          // ✓ no return value → empty body
gbl.Get("/bad", func() (string, error) { ... })     // ✗ startup failure: at most one return value
```

## Injectable parameter types

Every parameter is classified into one of five categories at startup; no type checks happen per request:

| Parameter type | What GBL injects |
|---|---|
| `*gbl.Context` | the request context (also the middleware argument) |
| `*http.Request` | the raw request |
| `http.ResponseWriter` (or any type satisfying the interface) | the framework's wrapped response writer — full control of the response |
| `multipart.FileHeader` / `*multipart.FileHeader` / `[]multipart.FileHeader` / `[]*multipart.FileHeader` | uploaded files matched by field name |
| any other type | a **business value** bound by name (see below) |

Injected parameters never trigger body parsing — a handler that only declares `*http.Request` never has its request body read at all.

## Business values: sources and priority

For each business parameter:

**Step 1: check for a path parameter with the same name; a hit wins immediately.** Path segments beat everything.

**Step 2: without a path hit, the source is chosen by `Content-Type` — one of two modes, not a cascading fallback:**

- **JSON mode**: `application/json` (including the `+json` suffix, e.g. `application/vnd.api+json`) with a non-blank body → values come only from the JSON body; form/query is never consulted.
- **form/query mode**: everything else (including JSON with an empty body) → values come from form/query. Under `POST`/`PUT`/`PATCH`, both body fields and same-named query values can bind, with **the body winning**.

Within either source, name matching is **exact first, then case-insensitive** (aligned with `encoding/json` field matching).

```go
// GET /user/42?verbose=true
// id comes from the :id path segment (path wins), verbose from query
gbl.Get("/user/:id", func(id string, verbose bool) string {
    return fmt.Sprintf("user %s verbose=%v", id, verbose)
})
```

### The method decides whether the body is read

`POST`/`PUT`/`PATCH` read and bind the body according to `Content-Type`; `GET`/`HEAD`/`DELETE`/`OPTIONS` **never read the body** — even if the client sends one it is discarded, and only path and query parameters are bound.

```go
// DELETE /items/7?hard=true (the body is ignored)
gbl.Delete("/items/:id", func(id string, hard bool) string {
    return fmt.Sprintf("delete %s hard=%v", id, hard)
})
```

## The three rules of JSON mode

> Prerequisite: struct fields must be exported (capitalized). JSON binding uses `encoding/json`, which only sets exported fields; unexported fields are silently ignored, stay zero, and raise no error. Form/query struct binding likewise only sees exported fields.

### Rule 1: a single business parameter ← the whole body

With exactly one business parameter, the entire JSON body is decoded into it in one shot — **not limited to structs**; scalars, slices and maps all work:

```go
// POST /user · Body: {"id": 1, "name": "ada"}
gbl.Post("/user", func(u User) *User {
    return &u // the whole body decodes into u
})

// POST /sum · Body: [1, 2, 3]
gbl.Post("/sum", func(nums []int) int {
    total := 0
    for _, n := range nums { total += n }
    return total // 6
})
```

### Rule 2: multiple business parameters ← top-level members keyed by parameter name

With a JSON body and multiple business parameters, the body must be a JSON object, and **every non-path parameter must have a top-level member named after it**:

```go
// POST /user · Body: {"u": {"id": 1, "name": "ada"}, "verbose": true}
gbl.Post("/user", func(u User, verbose bool) string {
    return fmt.Sprintf("%s verbose=%v", u.Name, verbose)
})
```

A missing top-level member is a request-time **400** (the error names the missing field), not a silent zero value. A non-object body (e.g. an array) is also a 400.

### Rule 3: path parameters still win

Even in JSON mode, a same-named path parameter hits first:

```go
// POST /user/42 · Body: {"id": 99, "verbose": true}
gbl.Post("/user/:id", func(id int, verbose bool) string {
    // id == 42 (path wins), verbose == true (body member)
    return fmt.Sprintf("%d %v", id, verbose)
})
```

## Struct binding in form/query mode

Struct parameters in form/query mode are filled **by field name** (case-insensitive, no struct tags needed):

- each field checks for a same-named path parameter first, then form/query values;
- nested structs recurse with the same rules;
- a `*struct` is allocated (zero value) even without a same-named source, so its fields can bind one by one.

```go
type User struct {
    ID   int
    Name string
}

// GET /user/42?name=ada → u.ID == 42 (from :id), u.Name == "ada"
gbl.Get("/user/:id", func(u User) string {
    return fmt.Sprintf("%d %s", u.ID, u.Name)
})
```

> JSON mode does not cross-fill like this — a single struct parameter comes only from the body (Rule 1).

## Conversion table for scalars and composites

Form/query values and path parameters are strings; GBL converts them to the target type:

| Target type | Conversion rule |
|---|---|
| `string` | verbatim |
| `bool` | `strconv.ParseBool` (`1/t/T/TRUE/true/True` etc.) |
| `int` / `int8` / `int16` / `int32` / `int64` | decimal parse, overflow checked against the bit width |
| `uint` / `uint8` / `uint16` / `uint32` / `uint64` / `uintptr` | decimal parse |
| `float32` / `float64` | `strconv.ParseFloat` |
| `complex64` / `complex128` | `strconv.ParseComplex` (e.g. `1+2i`) |
| pointers (`*int` etc.) | source missing → `nil`; present → points at the converted value |
| slices (`[]int` etc.) | consume **repeated values** (`?tag=a&tag=b`); missing → empty slice |
| `[]byte` | special: raw bytes of the first value, not repeated values |
| arrays (`[3]int`) | the number of repeated values **must equal the array length exactly**, otherwise 400 |
| structs | recursive by field name (see above) |

```go
// GET /filter?tag=go&tag=web&limit=10&ratio=0.5&debug=true
gbl.Get("/filter", func(tag []string, limit int, ratio float64, debug bool) string {
    return fmt.Sprintf("%v %d %.1f %v", tag, limit, ratio, debug)
})

// GET /point?z=1+2i
gbl.Get("/point", func(z complex128) string {
    return fmt.Sprintf("%v", z) // (1+2i)
})

// Optional parameter: absent means nil
gbl.Get("/maybe", func(p *int) string {
    if p == nil { return "absent" }
    return strconv.Itoa(*p)
})
```

Scalar parameters take the **first value**; use a slice or array to consume repeated values. A conversion failure (e.g. `limit=abc`) → 400, with the parameter name and reason in the error message.

## Automatic return-value serialization

The Content-Type is chosen at **registration time** from the static return type:

| Return type | Content-Type | Body |
|---|---|---|
| `string` | `text/plain; charset=utf-8` | verbatim |
| `[]byte` | `text/plain; charset=utf-8` | raw bytes |
| `bool` / integers / unsigned / floats / complex | `text/plain; charset=utf-8` | formatted text (`42`, `true`, `3.14`) |
| struct / map / array / non-byte slice / pointer / interface | `application/json; charset=utf-8` | JSON |
| nil pointer / nil interface | `application/json; charset=utf-8` | **empty body** |
| no return value | — | empty body, 200 |

```go
gbl.Get("/text", func() string { return "plain" })
gbl.Get("/num", func() int { return 42 })                       // "42"
gbl.Get("/json", func() map[string]int { return map[string]int{"n": 3} })
gbl.Get("/obj", func() *User { return &User{ID: 1} })           // {"ID":1,...}
gbl.Get("/none", func() {})                                     // empty body
gbl.Get("/nil", func() *User { return nil })                    // empty body
```

Serialization failure (e.g. returning a struct containing a channel) is a server-side error: the fixed text `response serialization failed` + 500, no internal details leaked.

## When you want raw reads and writes

Declare `http.ResponseWriter` or `*http.Request` to take full control:

```go
gbl.Get("/raw", func(w http.ResponseWriter) {
    w.WriteHeader(http.StatusCreated)
    _, _ = w.Write([]byte("direct"))
})

gbl.Post("/echo", func(r *http.Request) string {
    return r.Header.Get("X-Trace-Id")
})
```

Once a body has been written (by handler or middleware), the framework no longer writes the stashed result — what you wrote stands.

## Where parameter names come from

Go reflection exposes parameter **types**, not **names**. At startup GBL parses the handler's source file (AST) and recovers parameter names by the function's source position — closures resolve correctly too.

This creates one deployment constraint: when the source is unreadable at runtime (`-trimpath` builds, multi-stage images copying only the binary), handlers bound by name **fail at startup** with clear remediation guidance; a lone struct parameter is unaffected (field names come from reflection). See [Deployment & Builds](/docs/deployment).

Unnamed parameters (`func(string) string`) receive placeholder names `arg0`, `arg1`… — a request key with that exact name would match, but always name your parameters.

## Response policy on binding failure

| Failure | Status | What the client sees |
|---|---|---|
| missing parameter (multi-parameter JSON) / conversion failure / malformed body | 400 | the specific error (the client's own input problem, safe to echo) |
| body over the total limit | 413 | `Request Entity Too Large` |
| validation failure (`Validatable`) | 400 | generic `Bad Request` (rule details go only to the log) |
| return-value serialization failure | 500 | fixed text (server-side problem, nothing leaked) |

## Full example: an orders API

```go
type OrderQuery struct {
    Status string
    Limit  int
}

// GET /orders?status=paid&limit=20
// The struct binds from query by field name; Limit converts to int automatically
gbl.Get("/orders", func(q OrderQuery) []Order {
    return loadOrders(q.Status, q.Limit)
})

// POST /orders · the JSON body decodes into Order as a whole
// Order implements Validate() → validated automatically after binding (see "Validation")
gbl.Post("/orders", func(o Order) Order {
    o.ID = newID()
    save(o)
    return o
})
```

Next: [Routing](/docs/routing) — path syntax, match priority and automatic fallbacks.