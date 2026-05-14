/** localStorage: browser that created this room is treated as host for UX. */
export function jamHostStorageKey(roomId: string) {
  return `jam-room-host-${roomId}`;
}

export function markJamRoomHost(roomId: string) {
  try {
    window.localStorage.setItem(jamHostStorageKey(roomId), "1");
  } catch {
    /* ignore */
  }
}

export function isJamRoomHost(roomId: string): boolean {
  try {
    return window.localStorage.getItem(jamHostStorageKey(roomId)) === "1";
  } catch {
    return false;
  }
}
