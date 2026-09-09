import type { FastifyInstance } from 'fastify';

interface Post {
  id: number;
  text: string;
  topic: string;
  status: 'draft' | 'ready' | 'published';
  publishedAt?: string;
  xUrl?: string;
}

interface PostsResponse {
  posts: Array<Post>;
}

export async function registerPostsRoute(app: FastifyInstance): Promise<void> {
  app.get('/posts', async function postsHandler(): Promise<PostsResponse> {
    return {
      posts: [
        {
          id: 1,
          text: 'This is a published post.',
          topic: 'general',
          status: 'published',
          publishedAt: new Date().toISOString(),
          xUrl: 'https://example.com/threads/1',
        },
        {
          id: 2,
          text: 'This is a draft post.',
          topic: 'general',
          status: 'draft',
        },
        {
          id: 3,
          text: 'This is a ready post.',
          topic: 'general',
          status: 'ready',
        },
      ],
    };
  });
}
