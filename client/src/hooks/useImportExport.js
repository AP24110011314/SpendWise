import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importExportApi } from '@/api/importExport';

export function useImportHistory(params = {}) {
  return useQuery({
    queryKey: ['import', 'history', params],
    queryFn: () => importExportApi.batches(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePreviewImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importExportApi.preview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import', 'history'] });
    },
  });
}

export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, mapping, previewRows, options }) =>
      importExportApi.commit(file, { mapping: mapping || options, previewRows }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useUndoImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importExportApi.undo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useExportTransactions() {
  return useMutation({
    mutationFn: importExportApi.export,
  });
}