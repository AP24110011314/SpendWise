import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/api/transactions';

export function useTransactions(params = {}) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => transactionsApi.list(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTransaction(id) {
  return useQuery({
    queryKey: ['transactions', id],
    queryFn: () => transactionsApi.get(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => transactionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useBulkDeleteTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.bulkDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}