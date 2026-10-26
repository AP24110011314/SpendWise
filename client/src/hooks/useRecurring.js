import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringApi } from '@/api/recurring';

export function useRecurringRules() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: () => recurringApi.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recurringApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
  });
}

export function useUpdateRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => recurringApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
  });
}

export function useDeleteRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recurringApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
  });
}

export function useRunRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recurringApi.process,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}