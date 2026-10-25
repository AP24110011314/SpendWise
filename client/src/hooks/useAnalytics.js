import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';

export function useSummary(month) {
  return useQuery({
    queryKey: ['analytics', 'summary', month],
    queryFn: () => analyticsApi.summary(month),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useByCategory(month) {
  return useQuery({
    queryKey: ['analytics', 'byCategory', month],
    queryFn: () => analyticsApi.byCategory({ month }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrend(months = 6, referenceMonth) {
  return useQuery({
    queryKey: ['analytics', 'trend', months, referenceMonth],
    queryFn: () => analyticsApi.trend({ months, referenceMonth }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDaily(month) {
  return useQuery({
    queryKey: ['analytics', 'daily', month],
    queryFn: () => analyticsApi.daily(month),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompare(monthA, monthB) {
  return useQuery({
    queryKey: ['analytics', 'compare', monthA, monthB],
    queryFn: () => analyticsApi.compare(monthA, monthB),
    enabled: !!monthA && !!monthB,
    staleTime: 5 * 60 * 1000,
  });
}

export function useForecast() {
  return useQuery({
    queryKey: ['analytics', 'forecast'],
    queryFn: () => analyticsApi.forecast(),
    staleTime: 5 * 60 * 1000,
  });
}