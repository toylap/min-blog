import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/notion';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = process.env.NEXT_PUBLIC_SITE_URL || 'https://minsu.dev';
  const posts = await getAllPosts();

  return [
    { url, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...posts.map((p) => ({
      url: `${url}/posts/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
