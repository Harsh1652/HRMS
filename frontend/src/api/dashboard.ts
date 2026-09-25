import { api } from './client';
import type { DashboardStats, RecentJoiner } from '../types/api';

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/dashboard/stats');
  return data;
}

export async function fetchRecentJoiners(): Promise<RecentJoiner[]> {
  const { data } = await api.get<{ items: RecentJoiner[] }>('/dashboard/recent-joiners');
  return data.items;
}
