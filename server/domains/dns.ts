import dns from "dns/promises";

const EDGE_IP = "45.90.35.9";

export async function resolveA(domain: string): Promise<string[]> {
  try {
    const records = await dns.resolve4(domain);
    return records;
  } catch {
    return [];
  }
}

export async function resolveTxt(name: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(name);
    return records.map(chunks => chunks.join(""));
  } catch {
    return [];
  }
}

export async function checkTxtRecord(domain: string, expectedValue: string): Promise<boolean> {
  const txtHost = `_botfactory-verify.${domain}`;
  const values = await resolveTxt(txtHost);
  console.log(`[DNS] TXT ${txtHost} => ${JSON.stringify(values)}`);
  return values.some(v => v.trim() === expectedValue.trim());
}

export async function checkARecord(domain: string): Promise<boolean> {
  const ips = await resolveA(domain);
  console.log(`[DNS] A ${domain} => ${JSON.stringify(ips)}`);
  return ips.includes(EDGE_IP);
}

export function getEdgeIp(): string {
  return EDGE_IP;
}
