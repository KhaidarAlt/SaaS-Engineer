---
name: Database driver compatibility
description: Compatibility constraint for the provisioned PostgreSQL endpoint and serverless database drivers.
---

The provisioned database endpoint must use the PostgreSQL driver supported by the project environment; switching to a Neon serverless driver can make production health checks fail with an endpoint-disabled authentication error even when development works.

**Why:** The published autoscale process failed on its first database query after the driver switch, while the existing PostgreSQL driver served the same application successfully.

**How to apply:** Treat database-driver changes as deployment-sensitive. Verify the production start command and root health check before publishing, and do not assume a Neon-compatible connection string means the Neon serverless driver is supported.