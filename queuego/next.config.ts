import type { NextConfig } from "next";

const nextConfig = {
  allowedDevOrigins: ['192.168.2.104', '192.168.2.104:3000'],
};

export default nextConfig as unknown as NextConfig;
