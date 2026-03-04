/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/dash',
  assetPrefix: '/dash',

  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

}

export default nextConfig
