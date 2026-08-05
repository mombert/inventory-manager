# Invoice attachments — Appwrite setup

The code ships ready, but it talks to two Appwrite resources that do not
exist in your project yet. Until you create them, the part panel shows
*"Invoice storage is not set up in Appwrite yet"* and everything else in
the app carries on working normally.

Both live inside the project you already have. On the Free plan you get
one bucket and one database, which is exactly what this needs — no
upgrade required.

---

## 1. The storage bucket

Appwrite Console → **Storage** → **Create bucket**

| Setting | Value |
|---|---|
| Bucket ID | `invoices` — must be exact, it is hardcoded in `src/appwrite.js` |
| Name | Invoices |
| Maximum file size | **10 MB** |
| Allowed file extensions | `png`, `jpg`, `jpeg`, `pdf` |
| Encryption | On |
| Antivirus | On |

Then **Settings → Permissions** on the bucket, add role **Any** with
**Create**, **Read**, and **Delete**. This mirrors how `parts` is already
configured and is what lets the no-login tablet upload.

The extension list is a real safety net, not decoration — it is enforced
server-side, so a renamed `.exe` is refused even though the browser-side
check could be bypassed.

---

## 2. The `invoices` collection

Appwrite files cannot carry custom fields, so the link between a file and
a part lives in a collection.

Console → your database → **Create collection**, ID exactly `invoices`.

### Attributes

| Attribute | Type | Size | Required |
|---|---|---|---|
| `part_id` | String | 32 | yes |
| `file_id` | String | 64 | yes |
| `file_name` | String | 255 | yes |
| `mime_type` | String | 64 | no |
| `size_bytes` | Integer | — | no |

### Index

| Key | Type | Attribute |
|---|---|---|
| `part_id_key` | key | `part_id` (ASC) |

Without it, opening a part scans the whole collection. Fine at ten
invoices, not at a thousand.

### Permissions

Role **Any** with **Create**, **Read**, **Delete** — same as the bucket.

---

## 3. Check it

Open any part, click **Attach invoice**, pick a PDF or a photo. It should
appear in the list with its size and today's date. Reload the page and
confirm it is still there — that proves the collection row was written,
not just the file.

To confirm cleanup works, remove it and check **Storage → invoices** in
the console: the file should be gone, not orphaned.

---

## Watch your Free plan usage

This is the part worth a calendar reminder. Storage is capped at 2 GB and
API bandwidth at 5 GB a month, and **exceeding either freezes the whole
project** — the console drops to read-only and the parts list stops
working, not just invoices. It is not a soft limit that only affects the
new feature.

Storage is unlikely to be your problem: 173 parts with a scanned invoice
each is well under a gigabyte. Bandwidth is the one to watch, because
every thumbnail rendered in a part panel is a full-size download — the
app deliberately avoids Appwrite's image-transformation endpoint, which
would shrink transfers but is itself a metered resource on Free.

Two practical habits keep this comfortable:

- **Scan invoices as PDFs, or photograph them at a modest resolution.**
  A 300 KB scan and an 8 MB phone photo are the same document. The 10 MB
  cap is a backstop, not a target.
- **Check Organization → Usage once a month** for the first few months,
  until you know what your real numbers look like.

If it does get tight, the fix is Pro, which raises storage to 150 GB and
bandwidth to 300 GB.
