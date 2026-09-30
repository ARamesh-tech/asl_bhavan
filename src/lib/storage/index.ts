import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv, publicEnv } from "@/lib/env";
import { ValidationError } from "@/lib/errors";

/**
 * Object storage abstraction. Images are never stored in PostgreSQL — only their URL and
 * storage key. Two providers:
 *
 *   local  — writes under /public/uploads (fine for development; on Render attach a
 *            persistent disk at /opt/render/project/src/public/uploads or use S3).
 *   s3     — any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO).
 */

export type StoredObject = { key: string; url: string };

export interface StorageProvider {
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");

class LocalStorage implements StorageProvider {
  async put(key: string, body: Buffer, _contentType: string): Promise<StoredObject> {
    const target = path.join(LOCAL_ROOT, key);
    if (!target.startsWith(LOCAL_ROOT)) throw new Error("Invalid storage key");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return { key, url: this.publicUrl(key) };
  }
  async delete(key: string): Promise<void> {
    const target = path.join(LOCAL_ROOT, key);
    if (!target.startsWith(LOCAL_ROOT)) return;
    await unlink(target).catch(() => undefined);
  }
  publicUrl(key: string): string {
    return `${publicEnv.siteUrl.replace(/\/$/, "")}/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}

class S3Storage implements StorageProvider {
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client> | null = null;
  private get bucket() {
    return getEnv().S3_BUCKET!;
  }
  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import("@aws-sdk/client-s3").then(({ S3Client }) => {
        const env = getEnv();
        return new S3Client({
          region: env.S3_REGION ?? "auto",
          endpoint: env.S3_ENDPOINT,
          forcePathStyle: Boolean(env.S3_ENDPOINT),
          credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
        });
      });
    }
    return this.clientPromise;
  }
  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.client()).send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
    return { key, url: this.publicUrl(key) };
  }
  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.client()).send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
  }
  publicUrl(key: string): string {
    const env = getEnv();
    const base = env.S3_PUBLIC_URL ?? (env.S3_ENDPOINT ? `${env.S3_ENDPOINT.replace(/\/$/, "")}/${this.bucket}` : `https://${this.bucket}.s3.${env.S3_REGION ?? "us-east-1"}.amazonaws.com`);
    return `${base.replace(/\/$/, "")}/${key}`;
  }
}

let provider: StorageProvider | undefined;

export function storage(): StorageProvider {
  if (provider) return provider;
  const env = getEnv();
  provider = env.STORAGE_PROVIDER === "s3" && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? new S3Storage() : new LocalStorage();
  return provider;
}

/** Validate an uploaded image and store it under `<folder>/<random>.<ext>`. */
export async function storeImage(file: File, folder: "rooms" | "gallery" | "branding" | "posts"): Promise<StoredObject & { contentType: string; size: number }> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) throw new ValidationError("Only JPEG, PNG, WebP, AVIF or GIF images are allowed.", { file: "Unsupported type" });
  if (file.size > MAX_IMAGE_BYTES) throw new ValidationError(`Images must be under ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`, { file: "Too large" });
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buffer, file.type)) throw new ValidationError("The file does not appear to be a valid image.", { file: "Invalid image" });
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomBytes(12).toString("hex")}.${ext}`;
  const stored = await storage().put(key, buffer, file.type);
  return { ...stored, contentType: file.type, size: file.size };
}

/** Cheap magic-number sniff so a renamed script can't be uploaded as an "image". */
function looksLikeImage(buf: Buffer, type: string): boolean {
  if (buf.length < 12) return false;
  const hex = buf.subarray(0, 12).toString("hex");
  switch (type) {
    case "image/jpeg": return hex.startsWith("ffd8ff");
    case "image/png": return hex.startsWith("89504e470d0a1a0a");
    case "image/gif": return hex.startsWith("474946383");
    case "image/webp": return buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
    case "image/avif": return buf.subarray(4, 8).toString("ascii") === "ftyp";
    default: return false;
  }
}
