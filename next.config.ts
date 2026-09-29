import type { NextConfig } from "next";
import { validateDeploymentEnvironment } from "./src/lib/deployment";
validateDeploymentEnvironment(process.env);
const nextConfig: NextConfig = {
  // Leave room for multipart fields below Vercel's 4.5 MB request limit.
  experimental: { serverActions: { bodySizeLimit: "4300kb" } },
  outputFileTracingIncludes: {
    "/*": ["./supabase/certs/*.crt"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default nextConfig;
