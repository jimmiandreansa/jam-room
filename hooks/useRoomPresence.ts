"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildPresenceMeta,
  getOrCreatePresenceKey,
  type RoomPresenceMeta,
} from "@/lib/jamMemberDisplay";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { RoomMember } from "@/lib/types";

type PresenceStatus = "connecting" | "connected" | "error";

type UseRoomPresenceArgs = {
  roomId: string;
  user: User | null;
  anonymousLabel: string;
  isHost: boolean;
  enabled: boolean;
  onQueueChange: () => void;
  onCurrentPlayChange: () => void;
};

function presenceStateToMembers(
  state: Record<string, RoomPresenceMeta[]>,
): RoomMember[] {
  const members: RoomMember[] = [];
  for (const [presenceKey, payloads] of Object.entries(state)) {
    const meta = payloads[0];
    if (!meta) continue;
    members.push({
      presenceKey,
      kind: meta.kind,
      displayName: meta.display_name,
      avatarUrl: meta.avatar_url,
      anonymousEmoji: meta.anonymous_emoji,
      isHost: meta.is_host,
    });
  }
  return members.sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function useRoomPresence({
  roomId,
  user,
  anonymousLabel,
  isHost,
  enabled,
  onQueueChange,
  onCurrentPlayChange,
}: UseRoomPresenceArgs) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [status, setStatus] = useState<PresenceStatus>("connecting");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onQueueChangeRef = useRef(onQueueChange);
  const onCurrentPlayChangeRef = useRef(onCurrentPlayChange);

  useEffect(() => {
    onQueueChangeRef.current = onQueueChange;
  }, [onQueueChange]);

  useEffect(() => {
    onCurrentPlayChangeRef.current = onCurrentPlayChange;
  }, [onCurrentPlayChange]);

  const presenceKey = useMemo(
    () => (user?.id ? user.id : getOrCreatePresenceKey()),
    [user?.id],
  );

  const presenceMeta = useMemo(
    () => buildPresenceMeta(user, anonymousLabel, isHost),
    [user, anonymousLabel, isHost],
  );

  useEffect(() => {
    if (!enabled || !presenceKey) return;

    const supabase = getSupabaseBrowserClient();
    setStatus("connecting");

    const syncMembers = (channel: RealtimeChannel) => {
      const state = channel.presenceState<RoomPresenceMeta>();
      setMembers(presenceStateToMembers(state));
    };

    const channel = supabase.channel(`jam-room-${roomId}`, {
      config: { presence: { key: presenceKey } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          onQueueChangeRef.current();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "current_play",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          onCurrentPlayChangeRef.current();
        },
      )
      .on("presence", { event: "sync" }, () => syncMembers(channel))
      .on("presence", { event: "join" }, () => syncMembers(channel))
      .on("presence", { event: "leave" }, () => syncMembers(channel))
      .subscribe(async (subscribeStatus) => {
        if (subscribeStatus === "SUBSCRIBED") {
          setStatus("connected");
          await channel.track(presenceMeta);
          syncMembers(channel);
        } else if (subscribeStatus === "CHANNEL_ERROR") {
          setStatus("error");
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [enabled, roomId, presenceKey]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || status !== "connected") return;
    void channel.track(presenceMeta).then(() => {
      const state = channel.presenceState<RoomPresenceMeta>();
      setMembers(presenceStateToMembers(state));
    });
  }, [presenceMeta, status]);

  return {
    members,
    count: members.length,
    status,
    presenceKey,
  } as const;
}
