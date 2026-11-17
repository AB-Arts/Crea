/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Fichiers lus au rendu (gabarit, polices, logo, données) : inclus dans le paquet serveur
  // au cas où une route serait rendue à la demande plutôt qu'au build.
  outputFileTracingIncludes: {
    '/': [
      './ecommerce-reporting/templates/**',
      './ecommerce-reporting/assets/**',
      './ecommerce-reporting/scripts/lib/**',
      './ecommerce-reporting/examples/demo-mode/*.json',
    ],
    '/api/dataset': ['./ecommerce-reporting/examples/demo-mode/*.json'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Un reporting de ventes n'a pas à être indexé par les moteurs de recherche.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
