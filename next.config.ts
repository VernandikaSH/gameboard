import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allows the hand-authored SVG game thumbnails (e.g. ludo.svg) to be
    // served through next/image; these are local static assets we author
    // ourselves, not user-uploaded content.
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
