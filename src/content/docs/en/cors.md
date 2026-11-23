# CORS

```go
func SetCorsConfig(cc *CorsConfig) // pass nil to disable CORS
```

`SetCorsConfig` installs the cross-origin policy on the engine; `Run` then wraps the handler chain with it — preflights, origin/method/header matching, credentials and max-age. What the engine keeps is a **private deep copy** of your struct (all four slices cloned): later edits to the caller's struct can neither race the serving goroutines nor switch the policy mid-flight.

## CorsConfig

Build it with an ordinary struct literal; every field is exported:

```go
type CorsConfig struct {
    AllowedOrigins   []string      // allowed origins, or "*"
    AllowedMethods   []string      // HTTP methods allowed cross-origin
    AllowedHeaders   []string      // request headers accepted in preflights
    ExposedHeaders   []string      // response headers cross-origin clients may read
    AllowCredentials bool          // whether cross-origin credentials (cookies/auth) are allowed
    MaxAge           time.Duration // how long clients may cache preflight results
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

// Any site may read the API — but without credentials:
gbl.SetCorsConfig(&gbl.CorsConfig{
    AllowedOrigins: []string{"*"},
    AllowedMethods: []string{http.MethodGet},
})

gbl.SetCorsConfig(nil) // disable CORS again
```

## Safety policy: dangerous combinations blocked at startup

`AllowCredentials=true` together with a wildcard `"*"` in `AllowedOrigins` means any site could send credentialed cross-origin requests — explicitly forbidden by the CORS specification. A configuration hitting this rule aborts startup **at the `SetCorsConfig` call** (logged, then panic), instead of silently degrading at runtime:

```go
// ✗ Startup failure:
gbl.SetCorsConfig(&gbl.CorsConfig{
    AllowedOrigins:   []string{"*"},
    AllowCredentials: true,
})
// The error tells you: list the concrete origins allowed to send credentials, not a wildcard
```

## Request flow

The CORS layer wraps the engine and branches by request type:

```text
Request has an Origin?
├─ no Origin (same-origin / non-browser) → straight into the engine
├─ preflight (OPTIONS + Access-Control-Request-Method)
│   ├─ origin not allowed → 403 "CORS origin not allowed"
│   ├─ method not in AllowedMethods → 403 "CORS method not allowed"
│   ├─ request header not in AllowedHeaders → 403 "CORS header not allowed"
│   └─ pass → 204 + Allow-Methods/Allow-Headers/Max-Age + Vary
└─ actual request
    ├─ origin allowed → add Allow-Origin (+credentials/Expose-Headers) → into the engine
    └─ origin not allowed → no CORS headers, still processed normally by the engine
```

The last branch is worth understanding: a **non-preflight** request from a disallowed origin is not rejected server-side — it is processed as usual, the response simply carries no CORS headers, and the **browser** blocks JS from reading it. Server-side rejection happens only at the preflight stage.

## Matching details

- origin/method/header matching is **case-insensitive**;
- with the wildcard `"*"`, `Access-Control-Allow-Origin` returns the literal `*`; on an allow-list hit the request's Origin is **echoed verbatim**;
- `Vary: Origin` (plus `Vary: Access-Control-Request-Method, Access-Control-Request-Headers` on preflights) is added automatically — cache-friendly;
- `MaxAge > 0` is written to `Access-Control-Max-Age` in seconds.

## Full example: a separated frontend and backend

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

Next: [Compression](/docs/compression).