
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/(public)" | "/(app)" | "/" | "/accounts" | "/accounts/login" | "/accounts/signup" | "/(app)/admin" | "/api" | "/api/push" | "/api/push/subscribe" | "/api/pwa" | "/api/pwa/status" | "/api/theme" | "/api/v1" | "/api/v1/documents" | "/api/v1/expenses" | "/api/v1/fuel-records" | "/api/v1/maintenance-records" | "/api/v1/reminders" | "/api/v1/tire-records" | "/api/v1/[resource]" | "/auth" | "/auth/callback" | "/billing" | "/billing/checkout" | "/billing/conta" | "/billing/portal" | "/billing/webhook" | "/billing/webhook/stripe" | "/(public)/blog" | "/(public)/blog/[slug]" | "/(public)/cancelamento" | "/(app)/dashboard" | "/(app)/documents" | "/(app)/expenses" | "/files" | "/files/[...key]" | "/(app)/fuel" | "/(app)/garage" | "/healthz" | "/(public)/lgpd" | "/(app)/maintenance" | "/manifest.webmanifest" | "/offline" | "/onboarding" | "/(public)/politica" | "/(public)/precos" | "/(app)/reminders" | "/(public)/reports" | "/(app)/reports" | "/(public)/reports/sale" | "/(app)/reports/sale" | "/(public)/reports/sale/public" | "/(public)/reports/sale/public/[token]" | "/(app)/reports/sale/[motorcycleId]" | "/(public)/roadmap" | "/sw.js" | "/(public)/termos" | "/(app)/tires" | "/(app)/trabalho" | "/(app)/[feature]" | "/(app)/[feature]/export.csv";
		RouteParams(): {
			"/api/v1/[resource]": { resource: string };
			"/(public)/blog/[slug]": { slug: string };
			"/files/[...key]": { key: string };
			"/(public)/reports/sale/public/[token]": { token: string };
			"/(app)/reports/sale/[motorcycleId]": { motorcycleId: string };
			"/(app)/[feature]": { feature: string };
			"/(app)/[feature]/export.csv": { feature: string }
		};
		LayoutParams(): {
			"/(public)": { slug?: string | undefined; token?: string | undefined };
			"/(app)": { motorcycleId?: string | undefined; feature?: string | undefined };
			"/": { resource?: string | undefined; slug?: string | undefined; key?: string | undefined; token?: string | undefined; motorcycleId?: string | undefined; feature?: string | undefined };
			"/accounts": Record<string, never>;
			"/accounts/login": Record<string, never>;
			"/accounts/signup": Record<string, never>;
			"/(app)/admin": Record<string, never>;
			"/api": { resource?: string | undefined };
			"/api/push": Record<string, never>;
			"/api/push/subscribe": Record<string, never>;
			"/api/pwa": Record<string, never>;
			"/api/pwa/status": Record<string, never>;
			"/api/theme": Record<string, never>;
			"/api/v1": { resource?: string | undefined };
			"/api/v1/documents": Record<string, never>;
			"/api/v1/expenses": Record<string, never>;
			"/api/v1/fuel-records": Record<string, never>;
			"/api/v1/maintenance-records": Record<string, never>;
			"/api/v1/reminders": Record<string, never>;
			"/api/v1/tire-records": Record<string, never>;
			"/api/v1/[resource]": { resource: string };
			"/auth": Record<string, never>;
			"/auth/callback": Record<string, never>;
			"/billing": Record<string, never>;
			"/billing/checkout": Record<string, never>;
			"/billing/conta": Record<string, never>;
			"/billing/portal": Record<string, never>;
			"/billing/webhook": Record<string, never>;
			"/billing/webhook/stripe": Record<string, never>;
			"/(public)/blog": { slug?: string | undefined };
			"/(public)/blog/[slug]": { slug: string };
			"/(public)/cancelamento": Record<string, never>;
			"/(app)/dashboard": Record<string, never>;
			"/(app)/documents": Record<string, never>;
			"/(app)/expenses": Record<string, never>;
			"/files": { key?: string | undefined };
			"/files/[...key]": { key: string };
			"/(app)/fuel": Record<string, never>;
			"/(app)/garage": Record<string, never>;
			"/healthz": Record<string, never>;
			"/(public)/lgpd": Record<string, never>;
			"/(app)/maintenance": Record<string, never>;
			"/manifest.webmanifest": Record<string, never>;
			"/offline": Record<string, never>;
			"/onboarding": Record<string, never>;
			"/(public)/politica": Record<string, never>;
			"/(public)/precos": Record<string, never>;
			"/(app)/reminders": Record<string, never>;
			"/(public)/reports": { token?: string | undefined };
			"/(app)/reports": { motorcycleId?: string | undefined };
			"/(public)/reports/sale": { token?: string | undefined };
			"/(app)/reports/sale": { motorcycleId?: string | undefined };
			"/(public)/reports/sale/public": { token?: string | undefined };
			"/(public)/reports/sale/public/[token]": { token: string };
			"/(app)/reports/sale/[motorcycleId]": { motorcycleId: string };
			"/(public)/roadmap": Record<string, never>;
			"/sw.js": Record<string, never>;
			"/(public)/termos": Record<string, never>;
			"/(app)/tires": Record<string, never>;
			"/(app)/trabalho": Record<string, never>;
			"/(app)/[feature]": { feature: string };
			"/(app)/[feature]/export.csv": { feature: string }
		};
		Pathname(): "/" | "/accounts/login" | "/accounts/signup" | "/admin" | "/api/push/subscribe" | "/api/pwa/status" | "/api/theme" | `/api/v1/${string}` & {} | "/auth" | "/auth/callback" | "/billing" | "/billing/checkout" | "/billing/conta" | "/billing/portal" | "/billing/webhook/stripe" | "/blog" | `/blog/${string}` & {} | "/cancelamento" | "/dashboard" | "/documents" | "/expenses" | `/files/${string}` & {} | "/fuel" | "/garage" | "/healthz" | "/lgpd" | "/maintenance" | "/manifest.webmanifest" | "/offline" | "/onboarding" | "/politica" | "/precos" | "/reminders" | "/reports" | `/reports/sale/public/${string}` & {} | `/reports/sale/${string}` & {} | "/roadmap" | "/sw.js" | "/termos" | "/tires" | "/trabalho" | `/${string}/export.csv` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/.well-known/security.txt" | "/brand/favicon-32x32.png" | "/brand/favicon.ico" | "/brand/moto-track-icon.png" | "/brand/og-card.png" | "/brand/svg/moto-track-logo-horizontal-dark.svg" | "/brand/svg/moto-track-logo-horizontal-light.svg" | "/brand/web/android-chrome-192x192.png" | "/brand/web/android-chrome-512x512.png" | "/brand/web/apple-touch-icon.png" | "/brand/web/favicon-32x32.png" | string & {};
	}
}