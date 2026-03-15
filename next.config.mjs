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

    // Per permettere l'accesso da altri IP durante lo sviluppo e risolvere gli errori di Cross-Origin
    allowedDevOrigins: ['192.168.8.101:3000', 'localhost:3000'],
}

export default nextConfig
