import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

interface Filter {
  id: string;
  name: string;
  is_active: boolean;
  search_text: string | null;
  catalog_ids: number[] | null;
  brand_ids: number[] | null;
  size_ids: number[] | null;
  color_ids: number[] | null;
  material_ids: number[] | null;
  status_ids: number[] | null;
  price_from: string | null;
  price_to: string | null;
  currency: string;
  sort_by: string;
  scan_interval_seconds: number;
  pepite_enabled: boolean;
  pepite_threshold: string;
  created_at: string;
}

interface CreateFilterInput {
  name: string;
  search_text?: string | null;
  catalog_ids?: number[] | null;
  brand_ids?: number[] | null;
  size_ids?: number[] | null;
  color_ids?: number[] | null;
  material_ids?: number[] | null;
  status_ids?: number[] | null;
  price_from?: number | null;
  price_to?: number | null;
  currency?: string;
  sort_by?: string;
  scan_interval_seconds?: number;
  pepite_enabled?: boolean;
  pepite_threshold?: number;
}

export function useFilters() {
  return useQuery<Filter[]>({
    queryKey: ['filters'],
    queryFn: async () => {
      const { data } = await api.get('/filters');
      return data.data;
    },
  });
}

export function useFilter(id: string | undefined) {
  return useQuery<Filter>({
    queryKey: ['filters', id],
    queryFn: async () => {
      const { data } = await api.get(`/filters/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateFilterInput) => {
      const { data } = await api.post('/filters', input);
      return data.data as Filter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filters'] });
    },
  });
}

export function useUpdateFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: CreateFilterInput & { id: string }) => {
      const { data } = await api.put(`/filters/${id}`, input);
      return data.data as Filter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filters'] });
    },
  });
}

export function useDeleteFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/filters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filters'] });
    },
  });
}

export function useToggleFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/filters/${id}/toggle`);
      return data.data as Filter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filters'] });
    },
  });
}
