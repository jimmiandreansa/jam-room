"use client";

import Image from "next/image";
import { useState } from "react";
import { RoomMemberList } from "@/components/room/RoomMemberList";
import { Modal } from "@/components/ui/Modal";
import type { RoomMember } from "@/lib/types";

type RoomMembersProps = {
  members: RoomMember[];
  status: "connecting" | "connected" | "error";
  selfPresenceKey: string | null;
};

const MAX_AVATARS = 3;

/** Compact members chip (avatar stack + count) that opens a modal with the full list. */
export function RoomMembers({
  members,
  status,
  selfPresenceKey,
}: RoomMembersProps) {
  const [open, setOpen] = useState(false);
  const preview = members.slice(0, MAX_AVATARS);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Lihat anggota (${members.length})`}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white transition hover:bg-white/10 sm:text-sm"
      >
        {preview.length > 0 && (
          <span className="flex -space-x-2" aria-hidden>
            {preview.map((member) =>
              member.kind === "authenticated" && member.avatarUrl ? (
                <span
                  key={member.presenceKey}
                  className="relative h-6 w-6 overflow-hidden rounded-full bg-black ring-2 ring-jam-surface"
                >
                  <Image
                    src={member.avatarUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="24px"
                    unoptimized
                  />
                </span>
              ) : (
                <span
                  key={member.presenceKey}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs ring-2 ring-jam-surface"
                >
                  {member.anonymousEmoji ?? "🎵"}
                </span>
              ),
            )}
          </span>
        )}
        <span className="font-medium">Anggota</span>
        <span className="rounded-full bg-jam-accent/20 px-1.5 py-0.5 text-[11px] font-semibold text-jam-accent">
          {members.length}
        </span>
        {status === "connecting" && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-jam-muted"
            title="Menghubungkan…"
            aria-hidden
          />
        )}
        {status === "error" && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-amber-300"
            title="Gagal sync"
            aria-hidden
          />
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Anggota (${members.length})`}
      >
        {status === "connecting" && (
          <p className="mb-2 text-xs text-jam-muted">Menghubungkan…</p>
        )}
        {status === "error" && (
          <p className="mb-2 text-xs text-amber-300">Gagal sinkronisasi.</p>
        )}
        <RoomMemberList
          members={members}
          status={status}
          selfPresenceKey={selfPresenceKey}
          hideChrome
        />
      </Modal>
    </>
  );
}
