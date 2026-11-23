// A small reader for npm's tarballs (POSIX ustar with GNU long names), so
// the CLI and the data fetcher need no tar dependency.
import { gunzipSync } from "node:zlib";

/** Every regular file of a `.tgz`, by path. */
export function untgz(bytes: Uint8Array): Map<string, Uint8Array> {
  const buf = gunzipSync(bytes);
  const files = new Map<string, Uint8Array>();
  const text = new TextDecoder();
  let at = 0;
  let longName: string | null = null;
  while (at + 512 <= buf.length) {
    const header = buf.subarray(at, at + 512);
    if (header.every((b) => b === 0)) break;
    const field = (start: number, len: number) => text.decode(header.subarray(start, start + len)).replace(/\0.*$/s, "");
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1);
    const prefix = field(345, 155);
    const name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    longName = null;
    const body = buf.subarray(at + 512, at + 512 + size);
    if (type === "L") longName = text.decode(body).replace(/\0.*$/s, "");
    else if (type === "0" || type === "") files.set(name, body);
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}
