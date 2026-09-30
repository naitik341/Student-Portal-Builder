import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type Position = { date: string; meal: string; createdAt: string; id: number };

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for feedback pagination");
  return createHash("sha256").update(secret).digest();
}

export function encodeFeedbackCursor(position: Position): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(position), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function decodeFeedbackCursor(token: string, date: string, meal: string): { createdAt: Date; id: number } | null {
  if (token.length > 512 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const data = Buffer.from(token, "base64url");
  if (data.length < 29 || data.toString("base64url") !== token) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const value: unknown = JSON.parse(Buffer.concat([
      decipher.update(data.subarray(28)), decipher.final(),
    ]).toString("utf8"));
    if (typeof value !== "object" || value === null) return null;
    const cursor = value as Partial<Position>;
    if (cursor.date !== date || cursor.meal !== meal ||
        typeof cursor.createdAt !== "string" ||
        !Number.isSafeInteger(cursor.id) || (cursor.id ?? 0) < 1) return null;
    const createdAt = new Date(cursor.createdAt);
    if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== cursor.createdAt) return null;
    return { createdAt, id: cursor.id! };
  } catch {
    return null;
  }
}