/**
 * Generates a RFC 9562 UUIDv7 string.
 */
export function generateId(): string {
  const buf = new Uint8Array(16);
  const view = new DataView(buf.buffer);
  const ts = Date.now();

  view.setUint32(0, Math.floor(ts / 65536));
  view.setUint16(4, ts & 0xffff);

  crypto.getRandomValues(buf.subarray(6, 16));
  buf[6] = (buf[6] & 0x0f) | 0x70;
  buf[8] = (buf[8] & 0x3f) | 0x80;

  const hex = [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
