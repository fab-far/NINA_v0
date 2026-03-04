const isVercel = process.env.VERCEL === '1';
const basePath = isVercel ? '' : '/dash';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: basePath,
  assetPrefix: basePath,

  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

}

export default nextConfig
