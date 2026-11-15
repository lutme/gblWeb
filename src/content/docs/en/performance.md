# Performance

GBL's hot path is systematically optimized. This chapter explains **what was done and why**, and how to run the benchmarks yourself.

## Startup precomputation: zero per-request decisions

Registration only queues; `generateRoute` at `Run()` does all the heavy lifting once:

| Precomputed item | Work saved per request |
|---|---|
| each parameter's binding category (injected / file / business) | no per-request reflective type classification or interface-satisfaction probing |
| exportable field lists of struct parameters (index + name + type) | no per-request field introspection or CanSet checks |
| the `needsParse` flag | handlers binding no business values skip body/query parsing entirely |
| the return Content-Type | no per-request serialization-format decisions |
| parameter names (AST recovery) | each source file parsed once; the AST cache is released after startup |
| middleware chains (global + group + terminal) | one frozen slice per route, reused directly at request time |

## Object pools: reuse everything reusable

| Pool | Reused object |
|---|---|
| `contextPool` | Context (all references cleared before returning it) |
| `responseWriterPool` | response-writer wrapper (underlying writer reference detached before return) |
| `pathParamsPool` | path-parameter map |
| `paramsPool` | reflection call-argument slice (stores pointers to avoid boxing) |
| `bodyBufferPool` | JSON body read buffer (returned as soon as binding finishes; decoded results are independent copies) |
| `segmentPool` | path-segment slice for route matching |
| `colorBufPool` | console colorized-line buffer |

Pooling saves not just allocations but GC pressure — especially visible under high concurrency. Every pooled object is cleared of references before return, so no previous request's data stays pinned in memory or leaks into the next request.

## Route matching: zero-allocation hot path

- path segmentation uses `strings.Cut` to produce **substrings** sharing the original path's backing storage — no copying;
- the segment slice comes from a pool; once warm, matching produces no new allocations;
- static children are direct map lookups; only variable branches backtrack.

## Lazy boxing

The handler's raw return value is held as a `reflect.Value`; it is boxed into `any` and cached only when middleware actually calls `c.Result()`. Requests that never read Result (the vast majority) pay zero boxing allocations.

## The honest trade-off

The remaining gap versus mature frameworks comes from the inherent cost of **invoking arbitrary handler signatures via reflection** — the price of the core "signature is the API" feature, not something easily erased. GBL's strategy: push every non-reflection cost to the minimum (precomputation + pooling + zero-allocation matching), leaving reflection as the only major cost.

If your scenario is sensitive to extreme throughput and signatures are fixed, struct binding + a simple middleware chain is the fastest combination; avoid reading `Result()` in hot-path middleware (it triggers boxing).

## Run the benchmarks yourself

The repository ships in-process micro-benchmarks (standard library only — the main module stays zero-dependency):

```bash
go test -bench=. -benchmem -run=^$
```

Workloads:

| Benchmark | Scenario |
|---|---|
| `BenchmarkGblStatic` | static return, no parameters |
| `BenchmarkGblPathParam` | path-parameter binding |
| `BenchmarkGblJSON` | JSON body struct binding + return |
| `BenchmarkGblMiddleware` | two-layer middleware chain |

Each has a `Parallel` variant (shared engine, GOMAXPROCS concurrency) — exactly where object pools earn their keep under load. The gin comparison lives in the separate `ginbench` module, using the same harness and workloads, so the numbers are directly comparable.

> This site intentionally shows no concrete benchmark numbers: performance depends on hardware and Go version — trust the results of `go test -bench` on your own machine.

Next: [API Reference](/docs/api-reference).