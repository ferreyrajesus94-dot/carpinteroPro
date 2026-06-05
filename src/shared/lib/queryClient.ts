import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { captureException } from "./errorReporter";

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			captureException(error, {
				source: "react-query.query",
				metadata: { queryKey: query.queryKey },
			});
		},
	}),
	mutationCache: new MutationCache({
		onError: (error, _variables, _context, mutation) => {
			captureException(error, {
				source: "react-query.mutation",
				metadata: { mutationKey: mutation.options.mutationKey },
			});
		},
	}),
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5,
			retry: 1,
			gcTime: 1000 * 60 * 60 * 24,
		},
	},
});
