import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
          res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
        }
      },
    }),
  );

  app.use("*", (req, res, next) => {
    if (req.originalUrl === "/__ping" || req.originalUrl.startsWith("/api/")) {
      return next();
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
