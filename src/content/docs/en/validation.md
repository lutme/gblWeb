# Validation

```go
type Validatable interface {
    Validate() error
}
```

Any bound **business parameter** (pointers included) whose type implements `Validate() error` is validated automatically, **after binding and before the handler**. Types that don't implement it cost nothing.

## Basic usage

```go
type Signup struct {
    Email string
    Age   int
    Name  string
}

// One Validate per type — all field rules live in this single method.
// gbl imposes no rules of its own: use plain Go, or call your own validation library.
func (s Signup) Validate() error {
    if s.Email == "" {
        return errors.New("email is required")
    }
    if s.Age < 18 {
        return errors.New("must be 18 or older")
    }
    if len(s.Name) > 32 {
        return errors.New("name is too long")
    }
    return nil
}

// The handler needs no nil checks; a non-nil error from Validate yields a generic 400
gbl.Post("/signup", func(s Signup) string {
    return "signed up: " + s.Email
})
```

> `Signup` fields must likewise be exported (capitalized): JSON binding silently skips lowercase fields, so validation would only ever see zero values.

## Behavior on failure

- A non-nil error aborts the request with a **generic 400**; the handler never runs;
- the error text is **written only to the server log** (`request validation failed` + the error field), never echoed to the client — so `Validate` can safely describe internal rules;
- when several business parameters implement `Validatable`, they are checked in parameter order and **the first failure returns immediately**.

## Value and pointer receivers both work

`Validate` declared on either a value or a pointer receiver is triggered — GBL tries the value itself first, then its address:

```go
// A pointer receiver works even when the handler parameter is a value type
func (s *Signup) Validate() error { ... }

gbl.Post("/signup", func(s Signup) string { ... })   // ✓ validated
gbl.Post("/signup2", func(s *Signup) string { ... }) // ✓ also validated
```

## Injected parameters are not validated

Only business parameters (the ones bound by name) are checked. `*Context`, `*http.Request`, `http.ResponseWriter` and file parameters carry no client business data and are skipped.

## Bring your own validation library

GBL ties you to no validation scheme. `Validate` can call a third-party library (imported in your application module — GBL stays zero-dependency):

```go
func (s Signup) Validate() error {
    // Example: call the validator already used in your project
    return appvalidator.Struct(s)
}
```

## How it differs from binding errors

| Phase | Failure | Client | Log |
|---|---|---|---|
| binding | missing field / conversion failure / malformed JSON | 400 + **the specific reason** | — |
| validation | `Validate` returns an error | 400 **generic text** | the full error |

Binding errors describe the client's own malformed input, safe to echo; validation errors could expose business rules, so they go only to the log.

Next: [File Uploads](/docs/uploads).