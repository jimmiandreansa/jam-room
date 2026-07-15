import { NextResponse } from "next/server";
import { AuthError, requireAuthUser } from "@/lib/supabase-server";
import { deleteObject, objectExists, storedFileUrl } from "@/lib/r2";
import { DEFAULT_COVER_URL } from "@/lib/songConstants";

type RouteContext = { params: Promise<{ id: string }> };

type PatchBody = {
  title?: string;
  artist?: string | null;
  cover_key?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, supabase } = await requireAuthUser(request);
    const body = (await request.json()) as PatchBody;

    const { data: existing, error: fetchErr } = await supabase
      .from("songs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) {
        return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      }
      updates.title = t;
    }
    if (body.artist !== undefined) {
      updates.artist = body.artist?.trim() || null;
    }

    if (body.cover_key !== undefined) {
      let coverKey = body.cover_key?.trim() || null;
      if (coverKey && !coverKey.startsWith(`covers/${user.id}/`)) {
        return NextResponse.json({ error: "Invalid cover_key." }, { status: 403 });
      }
      if (coverKey) {
        const ok = await objectExists(coverKey);
        if (!ok) coverKey = null;
      }
      updates.cover_key = coverKey;
      updates.cover_url = coverKey ? storedFileUrl(coverKey) : DEFAULT_COVER_URL;
    }

    const { data, error } = await supabase
      .from("songs")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[songs PATCH]", e);
    return NextResponse.json({ error: "Failed to update song." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, supabase } = await requireAuthUser(request);

    const { data: existing, error: fetchErr } = await supabase
      .from("songs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { error: delErr } = await supabase.from("songs").delete().eq("id", id);
    if (delErr) throw delErr;

    try {
      await deleteObject(existing.file_key);
      if (existing.cover_key) await deleteObject(existing.cover_key);
    } catch (e) {
      console.error("[songs DELETE] R2 cleanup failed", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[songs DELETE]", e);
    return NextResponse.json({ error: "Failed to delete song." }, { status: 500 });
  }
}
