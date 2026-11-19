# 文件上传

文件只在携带 `multipart/form-data` 的体方法（POST/PUT/PATCH）上装配。文件参数按**字段名与参数名相同**的那个文件 part 匹配（精确匹配）。这条文件查找路径与文本 form/query 参数是两条独立的来源，互不相干。

## 支持的参数类型

```go
import "mime/multipart"

// 表单字段 "avatar" 下的单个文件
gbl.Post("/upload", func(avatar *multipart.FileHeader) string {
    if avatar == nil {
        return "no file"
    }
    return fmt.Sprintf("%s (%d bytes)", avatar.Filename, avatar.Size)
})

// 同一字段 "photos" 下的多个文件
gbl.Post("/gallery", func(photos []*multipart.FileHeader) string {
    return fmt.Sprintf("%d files uploaded", len(photos))
})
```

| 参数类型 | 装配结果 |
|---|---|
| `*multipart.FileHeader` | 匹配字段下的第一个文件；无上传 → `nil` |
| `multipart.FileHeader` | 第一个文件的值拷贝；无上传 → 零值 |
| `[]*multipart.FileHeader` | 匹配字段下的所有文件；无上传 → 空切片 |
| `[]multipart.FileHeader` | 所有文件的值拷贝；无上传 → 空切片 |

**没有上传时指针为 nil、切片为空——不会 panic。**

## 读取文件内容

`FileHeader.Open()` 打开文件（内存或临时文件，取决于大小阈值）：

```go
gbl.Post("/avatar", func(avatar *multipart.FileHeader) string {
    if avatar == nil {
        gbl.Abort(http.StatusBadRequest, "avatar is required")
    }
    f, err := avatar.Open()
    if err != nil {
        gbl.Abort(http.StatusBadRequest, "cannot read upload")
    }
    defer f.Close()
    data, _ := io.ReadAll(f)
    saveAvatar(data)
    return "saved " + avatar.Filename
})
```

> 请求结束后框架自动清理 multipart 临时文件——所以**要在 handler 内读完/拷贝走**，别把 `FileHeader` 留到请求之后。

## 三重独立限额

```go
type ByteSize int // 具名 int：类型名本身在调用点说明参数是字节数

func SetMaxBodySize(size ByteSize)       // 整个请求 body 的硬上限（超限 413）
func SetMaxFileSize(size ByteSize)       // multipart 单 part 内存阈值；更大的落临时文件
func SetMaxUploadFileSize(size ByteSize) // 每个上传文件的硬上限（超限 413）
```

| 设置 | 控制什么 | 超限后果 | 默认值 |
|---|---|---|---|
| `SetMaxBodySize` | **整个请求 body 的总大小**（含 multipart 上传） | 413 拒绝 | **5 MiB** |
| `SetMaxFileSize` | multipart 解析的**内存阈值**——不超过此大小的 part 留在内存，更大的落临时文件 | 无；它**不是**上限，从不拒绝请求 | **2 MiB** |
| `SetMaxUploadFileSize` | **每一个单独上传文件的最大大小**（任意字段、任意 part） | 进入 handler 前 413 拒绝 | **1 MiB** |

三个一起理解：

- `SetMaxBodySize` 是唯一针对**整体**的限制——不管 body 拆在多少字段上，总量过大就被拒；
- `SetMaxFileSize` 纯是**性能**设置（内存 vs 磁盘），不限制你能上传多少；
- `SetMaxUploadFileSize` 是唯一的**单文件**闸门：即使总量仍在 body 限额内，某一个文件过大也照样拒绝。

默认值的设计意图：单文件 1 MiB **低于** 整 body 5 MiB，所以开箱即用就有保护——任何单个文件不得超过 1 MiB，但整体仍可容纳多个小文件共 5 MiB。大文件上传对服务器有风险，这道上限默认强制拦截，确有需要时才调高。

```go
gbl.SetMaxBodySize(gbl.ByteSize(32 << 20))      // 总 body 上限 32 MiB
gbl.SetMaxFileSize(gbl.ByteSize(4 << 20))       // 超过 4 MiB 的 part 落临时文件
gbl.SetMaxUploadFileSize(gbl.ByteSize(5 << 20)) // 单文件最大 5 MiB
```

三个设置都只接受**正的** `ByteSize`，传非正值即启动失败（panic）。它们是互相独立的开关，可以在任何时候调用（原子生效）。

## 完整示例：带限额的相册上传

```go
func main() {
    gbl.SetMaxBodySize(gbl.ByteSize(20 << 20))      // 整个请求 ≤ 20 MiB
    gbl.SetMaxUploadFileSize(gbl.ByteSize(5 << 20)) // 单张 ≤ 5 MiB

    gbl.Post("/album", func(title string, photos []*multipart.FileHeader) string {
        // title 来自 multipart 的文本字段（body 优先于同名 query）
        // photos 来自名为 photos 的文件字段
        for _, p := range photos {
            savePhoto(title, p)
        }
        return fmt.Sprintf("album %q: %d photos", title, len(photos))
    })

    gbl.Run()
}
```

下一章：[日志](/docs/logging)。