/** Short, shareable room codes: 4 chars from a-z A-Z 0-9 (case-sensitive). */

const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 4;

export const ROOM_CODE_RE = /^[A-Za-z0-9]{4}$/;

/**
 * Generates a 4-character room code using crypto with rejection sampling to
 * avoid modulo bias across the 62-symbol alphabet.
 */
export function generateRoomCode(): string {
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let code = "";
  const buf = new Uint8Array(1);
  while (code.length < CODE_LENGTH) {
    crypto.getRandomValues(buf);
    const byte = buf[0];
    if (byte >= max) continue; // reject to keep distribution uniform
    code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}
