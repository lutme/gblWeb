# File Uploads

Files are bound only on body methods (POST/PUT/PATCH) carrying `multipart/form-data`. A file parameter matches the file part whose **field name equals the parameter name** (matched exactly). This file-lookup path and the text form/query parameters are two independent sources that never interfere.

## Supported parameter types

```go
import "mime/multipart"

// A single file under the form field "avatar"
gbl.Post("/upload", func(avatar *multipart.FileHeader) string {
    if avatar == nil {
        return "no file"
    }
    return fmt.Sprintf("%s (%d bytes)", avatar.Filename, avatar.Size)
})

// Multiple files under the same field "photos"
gbl.Post("/gallery", func(photos []*multipart.FileHeader) string {
    return fmt.Sprintf("%d files uploaded", len(photos))
})
```

| Parameter type | Binding result |
|---|---|
| `*multipart.FileHeader` | the first file under the matched field; no upload → `nil` |
| `multipart.FileHeader` | a value copy of the first file; no upload → zero value |
| `[]*multipart.FileHeader` | all files under the matched field; no upload → empty slice |
| `[]multipart.FileHeader` | value copies of all files; no upload → empty slice |

**Without uploads, pointers are nil and slices are empty — no panics.**

## Reading file content

`FileHeader.Open()` opens the file (in memory or a temp file, depending on the size threshold):

```go
gbl.Post("/avatar", func(c *gbl.Context, avatar *multipart.FileHeader) string {
    if avatar == nil {
        c.AbortWithStatusString(http.StatusBadRequest, "avatar is required")
        return ""
    }
    f, err := avatar.Open()
    if err != nil {
        c.AbortWithStatusString(http.StatusBadRequest, "cannot read upload")
        return ""
    }
    defer f.Close()
    data, _ := io.ReadAll(f)
    saveAvatar(data)
    return "saved " + avatar.Filename
})
```

> The framework cleans up multipart temp files automatically when the request ends — so **read or copy the content inside the handler**; never keep a `FileHeader` past the request.

## Three independent limits

```go
type ByteSize int // a named int: the type name itself documents that the argument is a byte count

func SetMaxBodySize(size ByteSize)       // hard cap on the whole request body (413 when exceeded)
func SetMaxFileSize(size ByteSize)       // aggregate multipart file-content memory threshold; excess spills to temp files
func SetMaxUploadFileSize(size ByteSize) // hard cap per uploaded file (413 when exceeded)
```

| Setting | What it controls | When exceeded | Default |
|---|---|---|---|
| `SetMaxBodySize` | **total size of the whole request body** (multipart uploads included) | rejected with 413 | **5 MiB** |
| `SetMaxFileSize` | the **aggregate memory threshold for multipart file content** — content up to this total stays in memory, and excess spills to temp files | nothing; it is *not* a cap and never rejects | **2 MiB** |
| `SetMaxUploadFileSize` | **the maximum size of each individual uploaded file** (any field, any part) | rejected with 413 before the handler | **1 MiB** |

Understanding the three together:

- `SetMaxBodySize` is the only limit on the **whole** — no matter how many fields the body is split across, an oversized total is rejected;
- `SetMaxFileSize` is purely a **performance** setting (memory vs disk); it does not limit how much you can upload, and file content beyond the combined threshold spills to temp files;
- `SetMaxUploadFileSize` is the only **per-file** gate: even when the total is still within the body limit, one oversized file is rejected all the same.

The defaults are deliberate: the per-file 1 MiB is **below** the whole-body 5 MiB, so you are protected out of the box — no single file may exceed 1 MiB, while the total can still hold several small files up to 5 MiB. Large uploads are a server risk; this cap blocks them by default, raise it only when you really need to.

```go
gbl.SetMaxBodySize(gbl.ByteSize(32 << 20))      // total body cap 32 MiB
gbl.SetMaxFileSize(gbl.ByteSize(4 << 20))       // combined file content over 4 MiB spills to temp files
gbl.SetMaxUploadFileSize(gbl.ByteSize(5 << 20)) // per-file maximum 5 MiB
```

All three setters accept only **positive** `ByteSize` values; a non-positive value fails startup (panic). They are independent assembling-time switches and must be called **before `Run`**; calling them while serving panics because the engine is read-only.

## Full example: an album upload with limits

```go
func main() {
    gbl.SetMaxBodySize(gbl.ByteSize(20 << 20))      // whole request ≤ 20 MiB
    gbl.SetMaxUploadFileSize(gbl.ByteSize(5 << 20)) // each photo ≤ 5 MiB

    gbl.Post("/album", func(title string, photos []*multipart.FileHeader) string {
        // title comes from a multipart text field (body wins over a same-named query)
        // photos comes from the file field named photos
        for _, p := range photos {
            savePhoto(title, p)
        }
        return fmt.Sprintf("album %q: %d photos", title, len(photos))
    })

    gbl.Run()
}
```

Next: [Logging](/docs/logging).