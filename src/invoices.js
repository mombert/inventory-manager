/* ============================================================
   Purchase invoices attached to a part.

   Two Appwrite resources are involved, and they do different jobs:

     - the `invoices` storage BUCKET holds the actual bytes
     - the `invoices` COLLECTION holds one row per file, recording
       which part it belongs to

   The collection is what makes "show me this part's invoices" a
   single indexed query. Appwrite files cannot carry custom fields,
   so without it the only way to associate a file with a part would
   be to encode the part id in the filename and do prefix matching —
   which breaks the moment someone renames a file in the console.

   Deleting is therefore two operations. The file goes first: if that
   fails we still have the row and can retry, whereas a row deleted
   before its file leaves bytes in the bucket that nothing points at
   and nothing can find.
   ============================================================ */

import { db, storage, DB_ID, INVOICES, BUCKET, ID, Query } from './appwrite';

/* Matches the bucket's own limits. Both are enforced server-side too —
   this copy exists to fail fast with a readable message instead of
   round-tripping a 20MB photo to be told no. */
export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPT    = '.png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf';

const ALLOWED = ['image/png', 'image/jpeg', 'application/pdf'];

export const isImage = (mime) => mime === 'image/png' || mime === 'image/jpeg';

export function prettySize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* A plain URL, so <img src> and target=_blank both work without the SDK
   in the loop. Anyone with the link can open it — the same trade-off the
   QR labels already make. */
export const fileUrl = (fileId) => storage.getFileView(BUCKET, fileId);

/* Thrown when the bucket or collection has not been created yet, so the
   UI can say "not set up" rather than showing a raw 404. */
export class NotProvisioned extends Error {}

function wrap(e) {
  if (e && (e.code === 404 || /could not be found/i.test(e.message || ''))) {
    return new NotProvisioned('Invoice storage is not set up in Appwrite yet.');
  }
  return e;
}

export async function listInvoices(partId) {
  try {
    const res = await db.listDocuments(DB_ID, INVOICES, [
      Query.equal('part_id', String(partId)),
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ]);
    return res.documents;
  } catch (e) {
    throw wrap(e);
  }
}

export async function uploadInvoice(partId, file, onProgress) {
  if (!ALLOWED.includes(file.type)) {
    throw new Error(`${file.name} is not a PNG, JPG or PDF.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} is ${prettySize(file.size)} — the limit is ${prettySize(MAX_BYTES)}.`);
  }

  let stored;
  try {
    stored = await storage.createFile(BUCKET, ID.unique(), file, undefined, onProgress);
  } catch (e) {
    throw wrap(e);
  }

  try {
    return await db.createDocument(DB_ID, INVOICES, ID.unique(), {
      part_id: String(partId),
      file_id: stored.$id,
      file_name: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
    });
  } catch (e) {
    // The row is what makes the file findable. Without it the upload is
    // just orphaned bytes, so take them back out.
    try { await storage.deleteFile(BUCKET, stored.$id); } catch (_) {}
    throw wrap(e);
  }
}

export async function deleteInvoice(record) {
  try {
    await storage.deleteFile(BUCKET, record.file_id);
  } catch (e) {
    // A file already gone by other means should not strand its row.
    if (e.code !== 404) throw wrap(e);
  }
  await db.deleteDocument(DB_ID, INVOICES, record.$id);
}
