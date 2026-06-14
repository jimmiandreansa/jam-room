import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/songConstants";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} on the server.`);
  return v;
}

let r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (r2Client) return r2Client;
  const accountId = requireEnv("R2_ACCOUNT_ID");
  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return r2Client;
}

export function getR2BucketName(): string {
  return requireEnv("R2_BUCKET_NAME");
}

export function songObjectKey(userId: string, fileId: string): string {
  return `songs/${userId}/${fileId}.mp3`;
}

export function coverObjectKey(userId: string, fileId: string, ext: string): string {
  return `covers/${userId}/${fileId}.${ext}`;
}

export async function createPresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 900,
): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function createPresignedGetUrl(
  key: string,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(
      new HeadObjectCommand({ Bucket: getR2BucketName(), Key: key }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }),
  );
}

/** Stable public-style URL stored in DB (stream API resolves signed URLs at play time). */
export function storedFileUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (base) return `${base}/${key}`;
  return `r2://${getR2BucketName()}/${key}`;
}
