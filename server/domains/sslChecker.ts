import https from "https";

export async function checkSsl(domain: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: domain,
        port: 443,
        path: "/__ping",
        method: "GET",
        timeout: 5000,
        rejectUnauthorized: true,
        headers: {
          "Host": domain,
          "User-Agent": "SmartCatalog-SSLChecker/1.0",
        },
      },
      (res) => {
        const code = res.statusCode || 0;
        if (code >= 200 && code < 400) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: `HTTP ${code}` });
        }
        res.resume();
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    req.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
    req.end();
  });
}
