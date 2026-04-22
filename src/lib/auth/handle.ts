// Render a player handle as Name#0042. Tag is left-padded to 4 digits.
// If tag is null (legacy row, RPC hasn't run yet), just return the name.
export function formatHandle(name: string, tag: number | null | undefined): string {
  if (tag == null) return name;
  return `${name}#${tag.toString().padStart(4, "0")}`;
}

export function formatTag(tag: number | null | undefined): string | null {
  if (tag == null) return null;
  return `#${tag.toString().padStart(4, "0")}`;
}
