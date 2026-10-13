'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AdminOverview,
  AdminRecords,
  GameDetail,
  GameListItem,
  Paged,
  PlayerDetail,
  PlayerSort,
  PlayerSummary,
} from '@shared/admin';

// All admin data goes through the Next.js /api/admin proxy (session-checked).

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api.get<AdminOverview>('/admin/overview'),
    refetchInterval: 60_000,
  });
}

export function useAdminGames(params: { page: number; q: string; status: '' | 'finished' | 'abandoned' }) {
  return useQuery({
    queryKey: ['admin', 'games', params],
    queryFn: () => api.get<Paged<GameListItem>>('/admin/games', { ...params, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminGame(id: string) {
  return useQuery({
    queryKey: ['admin', 'game', id],
    queryFn: () => api.get<GameDetail>(`/admin/games/${encodeURIComponent(id)}`),
  });
}

export function useAdminPlayers(params: { page: number; q: string; sort: PlayerSort }) {
  return useQuery({
    queryKey: ['admin', 'players', params],
    queryFn: () => api.get<Paged<PlayerSummary>>('/admin/players', { ...params, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminPlayer(playerId: string) {
  return useQuery({
    queryKey: ['admin', 'player', playerId],
    queryFn: () => api.get<PlayerDetail>(`/admin/players/${encodeURIComponent(playerId)}`),
  });
}

export function useAdminRecords() {
  return useQuery({
    queryKey: ['admin', 'records'],
    queryFn: () => api.get<AdminRecords>('/admin/records'),
  });
}
