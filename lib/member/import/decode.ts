/** Windows-1252 bytes 0x80–0x9F; unassigned bytes keep their control character, as in the WHATWG table. */
const WINDOWS_1252_C1 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";

const hasUtf8Bom = (bytes: Uint8Array) => bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;

/** Node 24's "windows-1252" decoder returns 0x80–0x9F as Latin-1 control characters, so those are mapped here. */
function decodeWindows1252(bytes: Uint8Array): string {
  return new TextDecoder("windows-1252")
    .decode(bytes)
    .replace(/[\u0080-\u009f]/g, (char) => WINDOWS_1252_C1[char.charCodeAt(0) - 0x80]);
}

/** File bytes to text: strips a UTF-8 BOM, then reads strict UTF-8 and falls back to Windows-1252 (older Excel "CSV"). */
export function decodeCsv(bytes: Uint8Array): string {
  const body = hasUtf8Bom(bytes) ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return decodeWindows1252(body);
  }
}
