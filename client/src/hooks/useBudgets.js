import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi } from '@/api/budgets';

export function useBudgets(params = {}) {
  return useQuery({
    queryKey: ['budgets', params],
    queryFn: () => budgetsApi.list(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBudgetProgress(params = {}) {
  return useQuery({
    queryKey: ['budgets', 'progress', params],
    queryFn: () => budgetsApi.progress(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: budgetsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => budgetsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: budgetsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useCopyBudgets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: budgetsApi.copy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}