import { create } from "zustand";
import type { QueueItem } from "@/lib/types";

/** What the YouTube player should render (driven by `current_play` + realtime). */
export type CurrentVideoState = { videoId: string } | null;

type JamState = {
  roomId: string | null;
  queue: QueueItem[];
  currentVideo: CurrentVideoState;
  setRoomId: (roomId: string | null) => void;
  setQueue: (queue: QueueItem[]) => void;
  setCurrentVideo: (current: CurrentVideoState) => void;
};

export const useJamStore = create<JamState>((set) => ({
  roomId: null,
  queue: [],
  currentVideo: null,
  setRoomId: (roomId) => set({ roomId }),
  setQueue: (queue) => set({ queue }),
  setCurrentVideo: (currentVideo) => set({ currentVideo }),
}));
