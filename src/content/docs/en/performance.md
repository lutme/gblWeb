# Performance

GBL's hot path is systematically optimized. This chapter explains **what was done and why**, and how to run credible comparisons in your own project.

## Startup precomputation

Registration only queues; `generateRoute` at `Run()` does the heavy lifting once:

| Precomputed item | Work saved per request |
|---|---|
| each parameter's binding category (injected / SSE / file / business) | no per-request reflective type classification or interface-satisfaction probing |
| exported struct-field lists (index + name + type) | no per-request field introspection or CanSet checks |
| `needsParse` and exact query-key lists | handlers without business or file parameters skip parsing; multi-key queries decode only bindable names |
| provisional return Content-Type | available before an early Flush; runtime serialization may still refine it while uncommitted |
| parameter names (source AST → binary DWARF) | recovered only when `needsNames` is true; self-describing structs do not need handler parameter names |
| middleware chains (global + group + endpoint) | one frozen slice per route, reused directly at request time |

## Object pools

| Pool | Reused object |
|---|---|
| `contextPool` | Context, with all references cleared before return |
| `keysPool` | `Context.Set/Get` key/value map |
| `responseWriterPool` | response-writer wrapper |
| `pathParamsPool` | path-parameter map for dynamic routes |
| `paramsPool` | reflection call-argument slice |
| `bodyBufferPool` | JSON and urlencoded body read buffer |
| `segmentPool` | path-segment slice for route matching |
| `colorBufPool` | console colorized-line buffer |
| `responseBufferPool` | return-value, SSE and compression output buffer |

Each `Compress` middleware also owns a pool of gzip writers. Pooling reduces allocations and GC pressure, but `sync.Pool` neither guarantees the same object nor an allocation-free path; correctness depends on resetting before return, not object identity.

## Per-request parsing

- the URL query is parsed at most once when needed; urlencoded body decoding does not re-parse it;
- multi-key queries decode only names the handler can bind, while preserving repeated values and standard percent-decoding behavior;
- JSON bodies use a pooled buffer, and the empty-body check is folded into parsing;
- multi-parameter JSON validates syntax once and retains only needed top-level raw slices instead of decoding the whole object repeatedly;
- form bodies also use a pooled buffer, with known-length preallocation only within the total body limit.

## Route matching

- static routes live in per-method maps and use O(1) lookup on the original path, with no path-parameter allocation on a hit;
- only a static miss checks repeated/trailing slashes and probes the normalized static path again;
- dynamic routes enter a segment tree, with segments sharing the original path's backing storage;
- segment slices and path-parameter maps are pooled; static children win inside the tree, and failed variable branches backtrack and clean up.

## Lazy boxing

The handler's raw return value is held as a `reflect.Value`; it is boxed into `any` and cached only when middleware calls `c.Result()`. Requests that never read `Result` do not pay that boxing cost.

## The honest trade-off

The remaining gap versus mature frameworks comes from the inherent cost of **invoking arbitrary handler signatures via reflection** — the price of the core "signature is the API" feature. GBL reduces overhead around reflection rather than promising to eliminate it.

## Run your own benchmarks

From your application module:

```bash
go test -bench=. -benchmem -run=^$ ./...
```

For credible comparisons:

- give both implementations identical payloads, routes and middleware;
- reuse requests and writers so fixture allocations do not pollute business costs;
- warm up first, then compare medians and distributions across repeated runs with `benchstat`;
- record `ns/op`, `B/op` and `allocs/op`, not throughput alone;
- use a shared engine for parallel benchmarks and ensure no test-only global state interferes.

Performance depends on hardware, Go version and workload. Trust measurements from your own environment.

Next: [API Reference](/docs/api-reference).
