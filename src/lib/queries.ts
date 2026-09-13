'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { HealthStatus, SoloGame, SoloGuessBody, SoloGuessResponse, SoloNewGameBody } from '@shared/api';

export const HEALTH_INTERVAL_MS = 5 * 60 * 1000;

export const queryKeys = {
  health: ['health'] as const,
};

/**
 * Pings the backend's /health. The host sleeps after inactivity, so this
 * retries until it answers and then keeps pinging every 5 minutes (even in a
 * background tab) to keep it warm. Every new mount refetches immediately.
 */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => api.get<HealthStatus>('/health', undefined, signal),
    refetchInterval: HEALTH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: true,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

export function useNewSoloGame() {
  return useMutation({
    mutationFn: (body: SoloNewGameBody) => api.post<SoloGame>('/solo', body),
  });
}

export function useSoloGuess(gameId: string | undefined) {
  return useMutation({
    mutationFn: (body: SoloGuessBody) => api.post<SoloGuessResponse>(`/solo/${gameId}/guess`, body),
  });
}
