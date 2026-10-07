import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server.js for the Docker image.
  output: "standalone",
  // libsodium ships its own wasm loader; leave it to Node instead of bundling it.
  serverExternalPackages: ["libsodium-wrappers"],
};

export default nextConfig;
