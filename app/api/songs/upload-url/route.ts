import { NextResponse } from "next/server";
import {
  AuthError,
  requireAuthUser,
} from "@/lib/supabase-server";
import {
  coverObjectKey,
  createPresignedPutUrl,
  songObjectKey,
} from "@/lib/r2";
import {
  COVER_MIMES,
  MAX_COVER_BYTES,
  MAX_MP3_BYTES,
  MP3_MIME,
} from "@/lib/songConstants";
import { randomUUID } from "crypto";

type UploadUrlBody = {
  kind: "audio" | "cover";
  filename?: string;
  contentType?: string;
  fileSize?: number;
};

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthUser(request);
    const body = (await request.json()) as UploadUrlBody;

    if (body.kind === "audio") {
      if (body.contentType !== MP3_MIME) {
        return NextResponse.json(
          { error: "Only MP3 (audio/mpeg) files are supported." },
          { status: 400 },
        );
      }
      if (typeof body.fileSize === "number" && body.fileSize > MAX_MP3_BYTES) {
        return NextResponse.json(
          { error: "File exceeds 50 MB limit." },
          { status: 400 },
        );
      }
      const fileId = randomUUID();
      const key = songObjectKey(user.id, fileId);
      const uploadUrl = await createPresignedPutUrl(key, MP3_MIME);
      return NextResponse.json({ uploadUrl, key, fileId });
    }

    if (body.kind === "cover") {
      const ct = body.contentType ?? "";
      if (!COVER_MIMES.includes(ct as (typeof COVER_MIMES)[number])) {
        return NextResponse.json(
          { error: "Cover must be JPEG, PNG, or WebP." },
          { status: 400 },
        );
      }
      if (typeof body.fileSize === "number" && body.fileSize > MAX_COVER_BYTES) {
        return NextResponse.json(
          { error: "Cover exceeds 2 MB limit." },
          { status: 400 },
        );
      }
      const ext =
        ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
      const fileId = randomUUID();
      const key = coverObjectKey(user.id, fileId, ext);
      const uploadUrl = await createPresignedPutUrl(key, ct);
      return NextResponse.json({ uploadUrl, key, fileId, ext });
    }

    return NextResponse.json({ error: "Invalid kind." }, { status: 400 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[upload-url]", e);
    return NextResponse.json({ error: "Failed to create upload URL." }, { status: 500 });
  }
}
