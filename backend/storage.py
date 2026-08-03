"""Portable image storage — MongoDB backed (no external dependencies).

Images are stored as documents in the 'uploads' collection with:
  _id: filename (uuid.ext)
  data: bytes (Binary)
  content_type: str
  size: int
  created_at: iso datetime

MongoDB's 16MB per document ceiling is more than enough for compressed product images.
Since MongoDB is the app's primary DB, exporting the site = exporting MongoDB. Fully portable.
"""
from datetime import datetime, timezone

MIME_BY_EXT = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp",
}


async def upload_image(db, filename: str, data: bytes, ext: str) -> str:
    content_type = MIME_BY_EXT.get(ext.lower(), "application/octet-stream")
    doc = {
        "_id": filename,
        "data": data,
        "content_type": content_type,
        "size": len(data),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.uploads.replace_one({"_id": filename}, doc, upsert=True)
    return filename


async def fetch_image(db, filename: str):
    doc = await db.uploads.find_one({"_id": filename})
    if not doc:
        return None, None
    return doc["data"], doc.get("content_type", "application/octet-stream")


async def delete_image(db, filename: str) -> bool:
    r = await db.uploads.delete_one({"_id": filename})
    return r.deleted_count > 0
