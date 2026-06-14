import { NextResponse } from "next/server";
import {
  AuthError,
  requireAuthUser,
} from "@/lib/supabase-server";
import { objectExists, storedFileUrl } from "@/lib/r2";
import { DEFAULT_COVER_URL } from "@/lib/songConstants";

type CreateSongBody = {
  title?: string;
  artist?: string | null;
  file_key?: string;
  cover_key?: string | null;
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
};

export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireAuthUser(request);
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[songs GET]", e);
    return NextResponse.json({ error: "Failed to load songs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireAuthUser(request);
    const body = (await request.json()) as CreateSongBody;

    const title = body.title?.trim();
    const fileKey = body.file_key?.trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (!fileKey) {
      return NextResponse.json({ error: "file_key is required." }, { status: 400 });
    }
    if (!fileKey.startsWith(`songs/${user.id}/`)) {
      return NextResponse.json({ error: "Invalid file_key." }, { status: 403 });
    }

    const exists = await objectExists(fileKey);
    if (!exists) {
      return NextResponse.json(
        { error: "Audio file not found in storage. Upload may have failed." },
        { status: 400 },
      );
    }

    let coverKey = body.cover_key?.trim() || null;
    if (coverKey && !coverKey.startsWith(`covers/${user.id}/`)) {
      return NextResponse.json({ error: "Invalid cover_key." }, { status: 403 });
    }
    if (coverKey) {
      const coverOk = await objectExists(coverKey);
      if (!coverOk) coverKey = null;
    }

    const coverUrl = coverKey ? storedFileUrl(coverKey) : DEFAULT_COVER_URL;

    const { data, error } = await supabase
      .from("songs")
      .insert({
        user_id: user.id,
        title,
        artist: body.artist?.trim() || null,
        file_key: fileKey,
        file_url: storedFileUrl(fileKey),
        cover_key: coverKey,
        cover_url: coverUrl,
        duration_seconds: body.duration_seconds ?? null,
        file_size_bytes: body.file_size_bytes ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[songs POST]", e);
    return NextResponse.json({ error: "Failed to create song." }, { status: 500 });
  }
}
