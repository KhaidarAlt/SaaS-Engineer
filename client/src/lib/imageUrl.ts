export function resolveImageUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("//") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  if (path.startsWith("/uploads/") || path.startsWith("/objects/")) {
    return path;
  }
  if (path.startsWith("objects/")) {
    return `/${path}`;
  }
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}
