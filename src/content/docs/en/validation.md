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

// The handler needs no nil checks; a non-nil Validate error yields a 400 echoing its text
gbl.Post("/signup", func(s Signup) string {
    return "signed up: " + s.Email
})
```

> `Signup` fields must likewise be exported (capitalized): JSON binding silently skips lowercase fields, so validation would only ever see zero values.

## Behavior on failure

- A non-nil error aborts the request with a **400 whose body is the error text verbatim**; the handler never runs;
- you wrote the message, so you own what it discloses — write what the client should see, and keep anything sensitive out of `Validate`;
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
| binding | missing JSON member / conversion failure | generic 400 | reflection detail (parameter names, Go types, strconv detail) |
| validation | `Validate` returns an error | 400 + **the error text verbatim** | — |

Binding errors are assembled by the framework from reflection internals and may carry internal identifiers, so only a generic 400 goes out with the detail in the log; validation messages are authored by the developer, who owns what they disclose, so they reach the client verbatim.

Next: [File Uploads](/docs/uploads).