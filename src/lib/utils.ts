export { cn } from "cn";

/** A URL path with its percent-encoding undone (a PO such as MR/2026/001 travels as MR%2F2026%2F001); as given when malformed. */
export function decodePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
