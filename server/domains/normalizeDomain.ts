export function normalizeDomain(raw: string): string {
  return raw.toLowerCase().trim().replace(/\.+$/, "").replace(/^www\./, "");
}

export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return false;
  if (domain.includes("..") || domain.startsWith(".") || domain.startsWith("-")) return false;
  const parts = domain.split(".");
  if (parts.length < 2) return false;
  return parts.every(p => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(p));
}

export function isPlatformDomain(domain: string): boolean {
  const pd = (process.env.PLATFORM_DOMAIN || "botfactory.kz").toLowerCase();
  return domain === pd || domain.endsWith(`.${pd}`);
}

export function getDomainType(domain: string): "subdomain" | "custom" {
  const pd = (process.env.PLATFORM_DOMAIN || "botfactory.kz").toLowerCase();
  return domain.endsWith(`.${pd}`) ? "subdomain" : "custom";
}
