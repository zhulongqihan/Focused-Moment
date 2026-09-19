// A content-change token, not a security digest. Computed only when audio changes.
export function audioFingerprint(data: string | null): string | null {
  if (!data) return null;
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < data.length; index += 1) {
    const code = data.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x5bd1e995);
  }
  return `v1:${data.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}
