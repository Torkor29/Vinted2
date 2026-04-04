import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import api from '../api/client.js';

export interface Article {
  id: number;
  vinted_id: string;
  filter_id: string | null;
  title: string | null;
  price: string;
  currency: string;
  brand_name: string | null;
  size_name: string | null;
  condition_name: string | null;
  photo_url: string | null;
  vinted_url: string;
  seller_username: string | null;
  seller_rating: string | null;
  is_pepite: boolean;
  estimated_market_price: string | null;
  price_difference_pct: string | null;
  detected_at: string;
}

interface ArticlesResponse {
  success: boolean;
  data: Article[];
  cursor: string | null;
  hasMore: boolean;
}

export function useArticles(filterId?: string, pepitesOnly?: boolean) {
  return useInfiniteQuery<ArticlesResponse>({
    queryKey: ['articles', filterId, pepitesOnly],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filterId) params.set('filter_id', filterId);
      if (pepitesOnly) params.set('pepites_only', 'true');
      if (pageParam) params.set('cursor', pageParam as string);
      params.set('limit', '20');

      const { data } = await api.get(`/articles?${params.toString()}`);
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.cursor : undefined,
  });
}

export function useRecentArticles() {
  return useQuery<Article[]>({
    queryKey: ['articles', 'recent'],
    queryFn: async () => {
      const { data } = await api.get('/articles/recent');
      return data.data;
    },
  });
}
