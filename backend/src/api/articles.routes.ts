import type { FastifyInstance } from 'fastify';
import { telegramAuthMiddleware } from './auth.middleware.js';
import { articleQuerySchema } from '../types/api.js';
import * as articleService from '../services/article.service.js';

export async function articlesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', telegramAuthMiddleware);

  // Get articles (with optional filter and pagination)
  app.get('/api/articles', async (request) => {
    const user = request.telegramUser!;

    const parsed = articleQuerySchema.safeParse(request.query);
    const params = parsed.success ? parsed.data : { limit: 20 };

    let articles;
    if (params.filter_id) {
      articles = await articleService.getArticlesByFilter(params.filter_id, params.cursor, params.limit);
    } else {
      articles = await articleService.getArticlesByUser(user.id, params.cursor, params.limit, params.pepites_only);
    }

    const lastArticle = articles[articles.length - 1];
    const cursor = lastArticle ? lastArticle.detected_at.toISOString() : null;

    return {
      success: true,
      data: articles,
      cursor,
      hasMore: articles.length === params.limit,
    };
  });

  // Get recent articles
  app.get('/api/articles/recent', async (request) => {
    const user = request.telegramUser!;
    const articles = await articleService.getArticlesByUser(user.id, undefined, 10);

    return { success: true, data: articles };
  });

  // Get pepites only
  app.get('/api/articles/pepites', async (request) => {
    const user = request.telegramUser!;

    const parsed = articleQuerySchema.safeParse(request.query);
    const params = parsed.success ? parsed.data : { limit: 20 };

    const articles = await articleService.getArticlesByUser(user.id, params.cursor, params.limit, true);

    const lastArticle = articles[articles.length - 1];
    const cursor = lastArticle ? lastArticle.detected_at.toISOString() : null;

    return {
      success: true,
      data: articles,
      cursor,
      hasMore: articles.length === params.limit,
    };
  });

  // Get single article
  app.get<{ Params: { id: string } }>('/api/articles/:id', async (request, reply) => {
    const articleId = parseInt(request.params.id, 10);
    const article = await articleService.getArticleById(articleId);

    if (!article || article.user_id !== request.telegramUser!.id) {
      return reply.status(404).send({ success: false, error: 'Article not found' });
    }

    return { success: true, data: article };
  });
}
