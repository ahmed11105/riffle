// Simple obfuscation for song titles in server responses. This isn't
// cryptography, it's just enough to stop casual devtools peeking.
// The title is Base64-encoded so it doesn't appear as readable text in
// the HTML or network response. The client decodes it when needed.

export function obfuscateTitle(title: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(title).toString("base64");
  }
  return btoa(unescape(encodeURIComponent(title)));
}

export function deobfuscateTitle(encoded: string): string {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(encoded, "base64").toString("utf8");
    }
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return encoded;
  }
}
