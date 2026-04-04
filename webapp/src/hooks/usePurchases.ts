import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

export interface Purchase {
  id: string;
  title: string;
  brand_name: string | null;
  category_name: string | null;
  vinted_url: string | null;
  photo_url: string | null;
  purchase_price: string;
  shipping_cost: string;
  total_cost: string;
  is_sold: boolean;
  sold_price: string | null;
  sold_platform_fee: string | null;
  profit: string | null;
  profit_pct: string | null;
  status: string;
  notes: string | null;
  purchased_at: string;
}

export interface PurchaseStats {
  totalInvested: number;
  totalRevenue: number;
  totalProfit: number;
  averageRoi: number;
  totalPurchases: number;
  totalSold: number;
  avgTimeToSellDays: number;
}

interface CreatePurchaseInput {
  article_id?: number | null;
  title: string;
  brand_name?: string | null;
  category_name?: string | null;
  vinted_url?: string | null;
  photo_url?: string | null;
  purchase_price: number;
  shipping_cost?: number;
  status?: string;
  notes?: string | null;
}

interface UpdatePurchaseInput {
  id: string;
  is_sold?: boolean;
  sold_price?: number | null;
  sold_shipping_cost?: number | null;
  sold_platform_fee?: number | null;
  sold_date?: string | null;
  status?: string;
  notes?: string | null;
}

export function usePurchases(status?: string) {
  return useQuery<Purchase[]>({
    queryKey: ['purchases', status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const { data } = await api.get(`/purchases${params}`);
      return data.data;
    },
  });
}

export function usePurchaseStats() {
  return useQuery<PurchaseStats>({
    queryKey: ['purchases', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/purchases/stats');
      return data.data;
    },
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePurchaseInput) => {
      const { data } = await api.post('/purchases', input);
      return data.data as Purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
  });
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdatePurchaseInput) => {
      const { data } = await api.put(`/purchases/${id}`, input);
      return data.data as Purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/purchases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
  });
}
