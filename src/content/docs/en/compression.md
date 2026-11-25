# Compression

`Compress(level int) HandlerFunc` returns a gzip response-compression middleware — the **only** ready-made middleware the framework ships. Compression happens after `c.Next()` returns: the handler has produced its result, the downstream chain has unwound, and the middleware replaces the **staged response body** with compressed data.

## The three conditions

All three must hold, otherwise the response passes through untouched:

1. the client accepts `gzip` or its compatible spelling `x-gzip` through `Accept-Encoding`;
2. the response `Content-Type` is compressible — every `text/*` type plus JSON, XML, CSS, JS, SVG, RSS/Atom; binary types (images, video, audio, PDF) are never compressed (already compressed, or gzip gains nothing);
3. the body is at least **1 KB** — smaller bodies gain little and the CPU cost is not worth it.

An explicit `gzip` entry takes precedence over the wildcard: `gzip;q=0, *;q=1` refuses gzip and cannot be re-enabled by the wildcard, while `*;q=0, gzip;q=1` still allows it. A quality value of zero or less is a refusal.

On a hit, the staged body is replaced and `Content-Encoding: gzip` is set. **Every response passing through a valid `Compress` middleware gains `Vary: Accept-Encoding`**, compressed or not, so caches can select the right representation. Output buffers and gzip writers are pooled to reduce repeated allocations, but the whole compression path is not guaranteed allocation-free.

## Compression levels

The level constants mirror `compress/gzip`, re-exported by the framework — no need to import the standard library directly:

| Constant | Value | Meaning |
|---|---|---|
| `DefaultCompression` | -1 | balanced (recommended default) |
| `NoCompression` | 0 | store only, no compression |
| `BestSpeed` | 1 | fastest |
| `BestCompression` | 9 | smallest output, highest CPU |
| `HuffmanOnly` | -2 | Huffman encoding only |

An invalid level never errors — the middleware silently skips compression and the response goes out as-is.

## Usage

Global:

```go
gbl.Use(gbl.Compress(gbl.DefaultCompression))
```

Per group:

```go
api := gbl.Group("/api")
api.GroupUse(gbl.Compress(gbl.BestSpeed))
```

`Compress` is ordinary middleware and obeys the assembling contract: register it via `Use` / `GroupUse` **before** `Run()` (see [Lifecycle](/docs/lifecycle)).

## Middleware ordering

Compress works in the response phase; the onion layering decides its behavior:

```go
gbl.Use(
    accessLog,                            // outermost: response phase runs last
    corsMiddleware,
    authMiddleware,                       // rejections happen outside the compression layer
    gbl.Compress(gbl.DefaultCompression), // innermost: first to see the handler result
)
```

- register it **after** auth/CORS (more inner): rejection responses are written by outer layers and naturally skip compression;
- register it **after** the access-log middleware (more inner): in the response phase inner layers run first, so the logging middleware reads the post-compression `c.Size()` at `c.Next()`'s return point.

## What never gets compressed

- **already-written responses**: a handler writing through an injected `http.ResponseWriter`, or a rejection written by the `Abort` family — the body is on the wire, the middleware does not touch it;
- **flushed responses**: once headers commit, including SSE streams, the middleware cannot replace the response with a buffered gzip body;
- **responses that already carry `Content-Encoding`**: with Compress stacked at several layers (global plus group), only the layer that sees the result first actually compresses; outer layers see the encoding header set and pass through — never a double deflate;
- **requests with no staged result**: the handler returns nothing, or the chain was stopped by `c.Abort()` before the handler;
- anything failing the three conditions: no gzip in `Accept-Encoding`, binary content type, body under 1 KB.

> Compress operates on the staged body inside the **return-value serialization pipeline** — normal business responses all travel that path, so it works for you almost always; only pipeline-bypassing writes (an injected writer) need to handle compression themselves.

Next: [Configuration](/docs/configuration).
