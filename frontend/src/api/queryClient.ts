import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './index';
import { showToast } from '../lib/toast';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { toastError?: boolean };
  }
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _vars, _context, mutation) => {
      if (mutation.options.meta?.toastError) showToast(error.message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // Un 4xx (enlace expirado, no encontrado) no se arregla reintentando
      retry: (failures, error) => {
        if (error instanceof ApiError && error.status !== null && error.status < 500) return false;
        return failures < 2;
      },
    },
  },
});
