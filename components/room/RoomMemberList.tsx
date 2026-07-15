"use client";

import Image from "next/image";
import type { RoomMember } from "@/lib/types";

type RoomMemberListProps = {
  members: RoomMember[];
  status: "connecting" | "connected" | "error";
  selfPresenceKey: string | null;
  /** When true, render only the list (no section wrapper/heading) — e.g. inside a modal. */
  hideChrome?: boolean;
};

export function RoomMemberList({
  members,
  status,
  selfPresenceKey,
  hideChrome = false,
}: RoomMemberListProps) {
  const emptyState = (
    <p className="text-sm text-jam-muted">
      {status === "connected"
        ? "Belum ada anggota terdeteksi."
        : "Menunggu koneksi…"}
    </p>
  );

  const list = (
    <ul className={`space-y-2 ${hideChrome ? "" : "max-h-48 overflow-y-auto"}`}>
      {members.map((member) => {
        const isSelf = Boolean(
          selfPresenceKey && member.presenceKey === selfPresenceKey,
        );
        return (
          <li
            key={member.presenceKey}
            className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 ${
              isSelf ? "bg-jam-accent/10 ring-1 ring-jam-accent/40" : ""
            }`}
          >
            {member.kind === "authenticated" && member.avatarUrl ? (
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-black">
                <Image
                  src={member.avatarUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="36px"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/50 text-lg"
                aria-hidden
              >
                {member.anonymousEmoji ?? "🎵"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {member.displayName}
                {isSelf ? (
                  <span className="ml-1 text-xs font-normal text-jam-muted">
                    (Anda)
                  </span>
                ) : null}
              </p>
            </div>
            {member.isHost ? (
              <span className="shrink-0 rounded-md bg-jam-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-jam-accent">
                Host
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  if (hideChrome) {
    return members.length === 0 ? emptyState : list;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-jam-surface/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-jam-muted">
          Anggota ({members.length})
        </h2>
        {status === "connecting" && (
          <span className="text-xs text-jam-muted">Menghubungkan…</span>
        )}
        {status === "error" && (
          <span className="text-xs text-amber-300">Gagal sync</span>
        )}
      </div>

      {members.length === 0 ? (
        emptyState
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {members.map((member) => {
            const isSelf = Boolean(
              selfPresenceKey && member.presenceKey === selfPresenceKey,
            );
            return (
              <li
                key={member.presenceKey}
                className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 ${
                  isSelf ? "bg-jam-accent/10 ring-1 ring-jam-accent/40" : ""
                }`}
              >
                {member.kind === "authenticated" && member.avatarUrl ? (
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-black">
                    <Image
                      src={member.avatarUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="36px"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/50 text-lg"
                    aria-hidden
                  >
                    {member.anonymousEmoji ?? "🎵"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {member.displayName}
                    {isSelf ? (
                      <span className="ml-1 text-xs font-normal text-jam-muted">
                        (Anda)
                      </span>
                    ) : null}
                  </p>
                </div>
                {member.isHost ? (
                  <span className="shrink-0 rounded-md bg-jam-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-jam-accent">
                    Host
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
