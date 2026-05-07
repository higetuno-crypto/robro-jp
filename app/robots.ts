import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/login', '/auth/'],
      },
    ],
    sitemap: 'https://ro-brojp.com/sitemap.xml',
    host: 'https://ro-brojp.com',
  };
}
