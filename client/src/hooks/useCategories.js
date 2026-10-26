import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/api/categories';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => categoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args) => {
      if (typeof args === 'string') {
        return categoriesApi.delete(args);
      }
      return categoriesApi.delete(args.id, args.reassignTo);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}