import { create } from "zustand";
import type { CurrentTrackState, QueueItem } from "@/lib/types";

type JamState = {
  roomId: string | null;
  queue: QueueItem[];
  currentTrack: CurrentTrackState;
  setRoomId: (roomId: string | null) => void;
  setQueue: (queue: QueueItem[]) => void;
  setCurrentTrack: (current: CurrentTrackState) => void;
};

export const useJamStore = create<JamState>((set) => ({
  roomId: null,
  queue: [],
  currentTrack: null,
  setRoomId: (roomId) => set({ roomId }),
  setQueue: (queue) => set({ queue }),
  setCurrentTrack: (currentTrack) => set({ currentTrack }),
}));
