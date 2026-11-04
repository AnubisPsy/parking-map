import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import * as api from './index';
import type { Parking, ReportSummary, Share, Track, TrackImportResult } from './schemas';

export const keys = {
  parkings: ['parkings'] as const,
  tracks: ['tracks'] as const,
  reports: ['reports', 'list'] as const,
  report: (id: string) => ['reports', 'detail', id] as const,
  shares: ['shares'] as const,
  shareData: (token: string) => ['share-data', token] as const,
};

// ── Consultas ───────────────────────────────────────────────────────

export const useParkings = () =>
  useQuery({ queryKey: keys.parkings, queryFn: ({ signal }) => api.fetchParkings(signal) });

export const useTracks = () =>
  useQuery({ queryKey: keys.tracks, queryFn: ({ signal }) => api.fetchTracks(signal) });

export const useReports = () =>
  useQuery({ queryKey: keys.reports, queryFn: ({ signal }) => api.fetchReports(signal) });

export const useReport = (id: string) =>
  useQuery({ queryKey: keys.report(id), queryFn: ({ signal }) => api.fetchReport(id, signal) });

export const useShares = () =>
  useQuery({ queryKey: keys.shares, queryFn: ({ signal }) => api.fetchShares(signal) });

export const useShareData = (token: string) =>
  useQuery({
    queryKey: keys.shareData(token),
    queryFn: ({ signal }) => api.fetchShareData(token, signal),
  });

// ── Eliminaciones con actualización optimista ───────────────────────

const OPTIMISTIC_KEY = ['optimistic-delete'];

// Aplica el cambio en la caché de inmediato, lo revierte si el servidor falla
// y resincroniza al terminar la última eliminación en curso.
function useOptimisticDelete<V, R>(
  mutationFn: (vars: V) => Promise<R>,
  queryKeys: QueryKey[],
  apply: (vars: V, client: QueryClient) => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: OPTIMISTIC_KEY,
    mutationFn,
    meta: { toastError: true },
    onMutate: async (vars: V) => {
      await Promise.all(queryKeys.map((queryKey) => client.cancelQueries({ queryKey })));
      const snapshot = queryKeys.map((queryKey) => ({
        queryKey,
        data: client.getQueryData(queryKey),
      }));
      apply(vars, client);
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      context?.snapshot.forEach(({ queryKey, data }) => client.setQueryData(queryKey, data));
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: OPTIMISTIC_KEY }) === 1) {
        queryKeys.forEach((queryKey) => client.invalidateQueries({ queryKey }));
      }
    },
  });
}

function filterCache<T>(client: QueryClient, key: QueryKey, keep: (item: T) => boolean) {
  client.setQueryData<T[]>(key, (prev) => prev?.filter(keep));
}

export const useDeleteParking = () =>
  useOptimisticDelete(api.deleteParking, [keys.parkings], (id: string, client) =>
    filterCache<Parking>(client, keys.parkings, (p) => p.id !== id),
  );

export const useDeleteParkingsByUnit = () =>
  useOptimisticDelete(api.deleteParkingsByUnit, [keys.parkings], (unitId: string, client) =>
    filterCache<Parking>(client, keys.parkings, (p) => p.unit_id !== unitId),
  );

export const useDeleteAllParkings = () =>
  useOptimisticDelete(() => api.deleteAllParkings(), [keys.parkings], (_: void, client) =>
    client.setQueryData<Parking[]>(keys.parkings, []),
  );

export const useDeleteTrack = () =>
  useOptimisticDelete(api.deleteTrack, [keys.tracks, keys.parkings], (id: string, client) => {
    filterCache<Track>(client, keys.tracks, (t) => t.id !== id);
    filterCache<Parking>(client, keys.parkings, (p) => p.track_id !== id);
  });

export const useDeleteReport = () =>
  useOptimisticDelete(api.deleteReport, [keys.reports], (id: string, client) =>
    filterCache<ReportSummary>(client, keys.reports, (r) => r.id !== id),
  );

export const useDeleteShares = () =>
  useOptimisticDelete(
    async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map(api.deleteShare));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) throw new Error(`No se pudieron eliminar ${failed} enlace(s).`);
    },
    [keys.shares],
    (ids: string[], client) =>
      filterCache<Share>(client, keys.shares, (s) => !ids.includes(s.id)),
  );

// ── Creaciones ──────────────────────────────────────────────────────

export function useCreateParking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createParking,
    onSuccess: (parking) => {
      client.setQueryData<Parking[]>(keys.parkings, (prev) => [parking, ...(prev ?? [])]);
    },
  });
}

export function useImportParkings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createParkingsBulk,
    onSuccess: ({ created }) => {
      client.setQueryData<Parking[]>(keys.parkings, (prev) => [...created, ...(prev ?? [])]);
    },
  });
}

// Actualiza la caché con los recorridos ya guardados, sustituyendo los reemplazados
export function useApplyImportedTracks() {
  const client = useQueryClient();
  return (results: TrackImportResult[]) => {
    const replacedTracks = new Set(results.map((r) => r.replaced_track_id).filter(Boolean));
    const replacedParkings = new Set(results.flatMap((r) => r.replaced_parking_ids));
    client.setQueryData<Track[]>(keys.tracks, (prev) => [
      ...results.map((r) => r.track),
      ...(prev ?? []).filter((t) => !replacedTracks.has(t.id)),
    ]);
    client.setQueryData<Parking[]>(keys.parkings, (prev) => [
      ...results.flatMap((r) => r.parkings),
      ...(prev ?? []).filter((p) => !replacedParkings.has(p.id)),
    ]);
  };
}

export function useCreateReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createReport,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.reports }),
  });
}

export function useCreateShareLink() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createShareLink,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.shares }),
  });
}
