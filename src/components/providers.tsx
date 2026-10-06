"use client";
import { trpc } from "@/lib/trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { TimezoneBootstrap } from "@/components/account/TimezoneBootstrap";
import { WebVitalsReporter } from "@/components/metrics/WebVitalsReporter";

export function Providers({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 5 * 60 * 1000,
						gcTime: 15 * 60 * 1000,
						refetchOnWindowFocus: false,
						// One retry, not the default three -- a slow/down Open
						// Library shouldn't make the user wait through 3x10s of
						// connect timeouts before the error surfaces.
						retry: 1,
					},
				},
			}),
	);
	const [trpcClient] = useState(() =>
		trpc.createClient({
			links: [
				httpBatchLink({
					url: "/api/trpc",
					maxItems: 10,
					transformer: superjson,
				}),
			],
		}),
	);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>
				<SessionProvider>
					<TimezoneBootstrap />
					<WebVitalsReporter />
					<ConfirmProvider>{children}</ConfirmProvider>
				</SessionProvider>
				<Toaster
					position="top-right"
					toastOptions={{
						style: {
							background: "var(--surface)",
							color: "var(--fg)",
							border: "2px solid var(--fg)",
							borderRadius: "12px",
							boxShadow: "4px 4px 0 var(--fg)",
							fontFamily:
								"var(--font-dm-sans), system-ui, sans-serif",
							fontWeight: "500",
						},
					}}
				/>
			</QueryClientProvider>
		</trpc.Provider>
	);
}
