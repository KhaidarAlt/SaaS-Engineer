import type { Express, Request, Response, NextFunction } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { canAccessObject, getObjectAclPolicy } from "./objectAcl";
import { ObjectPermission } from "./objectAcl";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  const requireAuthForUpload = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Не авторизован" });
    }
    next();
  };

  app.post("/api/uploads/request-url", requireAuthForUpload, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      if (size && size > MAX_FILE_SIZE) {
        return res.status(400).json({
          error: "File too large. Maximum size is 10MB.",
        });
      }

      if (contentType && !ALLOWED_CONTENT_TYPES.includes(contentType)) {
        return res.status(400).json({
          error: "Invalid content type. Only images are allowed.",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.post("/api/uploads/set-public", requireAuthForUpload, async (req, res) => {
    try {
      const { objectPath } = req.body;
      
      if (!objectPath) {
        return res.status(400).json({ error: "Missing objectPath" });
      }
      
      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: (req.user as any).id,
        visibility: "public",
      });
      
      res.json({ success: true, objectPath });
    } catch (error) {
      console.error("Error setting public ACL:", error);
      res.status(500).json({ error: "Failed to set public access" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      
      const aclPolicy = await getObjectAclPolicy(objectFile);
      
      if (!aclPolicy || aclPolicy.visibility !== "public") {
        const userId = req.user?.id;
        
        if (!aclPolicy && !userId) {
          return res.status(403).json({ error: "Access denied" });
        }
        
        const hasAccess = await canAccessObject({
          userId,
          objectFile,
          requestedPermission: ObjectPermission.READ,
        });
        
        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
