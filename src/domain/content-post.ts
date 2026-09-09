export type PostStatus = 'draft' | 'ready' | 'published';

export interface ContentPost {
  notionPageId: string;
  title: string;
  text: string;
  topic: string | null;
  status: PostStatus;
  xPostId: string | null;
  xUrl: string | null;
  publishedAt: Date | null;
}

export type ReadyContentPost = ContentPost & { status: 'ready' };
