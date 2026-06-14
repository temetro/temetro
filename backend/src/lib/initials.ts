// Derive up-to-2-character initials from a patient name, for records (e.g. AI
// imports) that arrive without them. "Ahmed Ali" -> "AA"; "Ahmed" -> "AH".
export function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    return (words[0] as string).slice(0, 2).toUpperCase();
  }
  return ((words[0]![0] ?? "") + (words.at(-1)![0] ?? "")).toUpperCase();
}
