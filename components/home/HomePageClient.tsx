"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthButton } from "@/components/auth/AuthButton";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSupabaseConfigured } from "@/hooks/useSupabaseConfig";
import { getErrorMessage } from "@/lib/errorMessage";
import { markJamRoomHost } from "@/lib/jamHost";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function HomePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const configured = useSupabaseConfigured();
  const [roomName, setRoomName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const raw = searchParams.get("room");
    if (!raw) return;
    const id = raw.trim();
    if (UUID_RE.test(id)) setRoomId(id);
  }, [searchParams]);

  async function createRoom() {
    setCreateError(null);
    setJoinError(null);
    const name = roomName.trim();
    if (!name) {
      setCreateError("Masukkan nama room.");
      return;
    }
    setBusy("create");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: insertError } = await supabase
        .from("rooms")
        .insert({ name })
        .select("id")
        .single();
      if (insertError) throw insertError;
      if (!data?.id) throw new Error("Server tidak mengembalikan ID room.");
      markJamRoomHost(data.id);
      router.push(`/room/${data.id}`);
    } catch (e) {
      console.error("[createRoom]", e);
      setCreateError(
        getErrorMessage(
          e,
          "Gagal membuat room. Periksa koneksi dan pengaturan Supabase (RLS/policy).",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function joinRoom() {
    setJoinError(null);
    setCreateError(null);
    const id = roomId.trim();
    if (!UUID_RE.test(id)) {
      setJoinError("Masukkan UUID room yang valid (salin dari host).");
      return;
    }
    setBusy("join");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: fetchError } = await supabase
        .from("rooms")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!data) {
        setJoinError("Room tidak ditemukan.");
        return;
      }
      router.push(`/room/${id}`);
    } catch (e) {
      console.error("[joinRoom]", e);
      setJoinError(
        getErrorMessage(
          e,
          "Gagal bergabung ke room. Periksa koneksi dan pengaturan Supabase.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  if (!configured) {
    return (
      <PageShell
        title="Jam Room App"
        subtitle="Dengarkan musik bersama dengan antrean yang sama."
      >
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-sm text-amber-100">
          <p className="font-medium">
            Variabel lingkungan Supabase belum diatur.
          </p>
          <p className="mt-2 text-amber-100/80">
            Tambahkan{" "}
            <code className="rounded bg-black/30 px-1">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            dan{" "}
            <code className="rounded bg-black/30 px-1">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            ke file{" "}
            <code className="rounded bg-black/30 px-1">.env.local</code>, lalu
            jalankan ulang{" "}
            <code className="rounded bg-black/30 px-1">npm run dev</code>.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Jam Room App"
      subtitle="Buat room, bagikan tautan atau ID, dan antrekan lagu dari library bersama."
    >
      <div className="mb-6 flex justify-end">
        <AuthButton />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <section className="rounded-2xl border border-white/10 bg-jam-surface/80 p-6 shadow-xl shadow-black/30">
          <h2 className="text-lg font-semibold text-white">Buat room</h2>
          <p className="mt-1 text-sm text-jam-muted">
            Pilih nama tampilan. Anda akan mendapat tautan undangan dan ID untuk
            dibagikan. Tidak perlu login.
          </p>
          <div className="mt-4 space-y-4">
            <Input
              label="Nama room"
              name="room-name"
              placeholder="Jumat malam bareng"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              disabled={!!busy}
            />
            <Button
              type="button"
              className="w-full"
              onClick={() => void createRoom()}
              disabled={!!busy}
            >
              {busy === "create" ? "Membuat…" : "Buat room"}
            </Button>
            {createError && (
              <p className="text-sm text-red-400" role="alert">
                {createError}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-jam-surface/80 p-6 shadow-xl shadow-black/30">
          <h2 className="text-lg font-semibold text-white">Gabung room</h2>
          <p className="mt-1 text-sm text-jam-muted">
            Buka tautan undangan dari host, atau tempel ID room di bawah.
          </p>
          <div className="mt-4 space-y-4">
            <Input
              label="ID room"
              name="room-id"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={!!busy}
            />
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => void joinRoom()}
              disabled={!!busy}
            >
              {busy === "join" ? "Bergabung…" : "Gabung room"}
            </Button>
            {joinError && (
              <p className="text-sm text-red-400" role="alert">
                {joinError}
              </p>
            )}
          </div>
        </section>

        <p className="text-center text-xs text-jam-muted">
          Ingin menambah lagu?{" "}
          <Link href="/library" className="text-jam-accent hover:underline">
            Masuk dengan Google
          </Link>{" "}
          dan upload MP3 ke library publik.
        </p>
      </div>
    </PageShell>
  );
}
