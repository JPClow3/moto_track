export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([".well-known/security.txt","brand/favicon-32x32.png","brand/favicon.ico","brand/moto-track-icon.png","brand/og-card.png","brand/svg/moto-track-logo-horizontal-dark.svg","brand/svg/moto-track-logo-horizontal-light.svg","brand/web/android-chrome-192x192.png","brand/web/android-chrome-512x512.png","brand/web/apple-touch-icon.png","brand/web/favicon-32x32.png"]),
	mimeTypes: {".txt":"text/plain",".png":"image/png",".svg":"image/svg+xml"},
	_: {
		client: null,
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js')),
			__memo(() => import('./nodes/15.js')),
			__memo(() => import('./nodes/16.js')),
			__memo(() => import('./nodes/17.js')),
			__memo(() => import('./nodes/18.js')),
			__memo(() => import('./nodes/19.js')),
			__memo(() => import('./nodes/20.js')),
			__memo(() => import('./nodes/21.js')),
			__memo(() => import('./nodes/22.js')),
			__memo(() => import('./nodes/23.js')),
			__memo(() => import('./nodes/24.js')),
			__memo(() => import('./nodes/25.js')),
			__memo(() => import('./nodes/26.js')),
			__memo(() => import('./nodes/27.js')),
			__memo(() => import('./nodes/28.js')),
			__memo(() => import('./nodes/29.js')),
			__memo(() => import('./nodes/30.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/accounts/login",
				pattern: /^\/accounts\/login\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/accounts/login/_server.ts.js'))
			},
			{
				id: "/accounts/signup",
				pattern: /^\/accounts\/signup\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/accounts/signup/_server.ts.js'))
			},
			{
				id: "/(app)/admin",
				pattern: /^\/admin\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/api/push/subscribe",
				pattern: /^\/api\/push\/subscribe\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/push/subscribe/_server.ts.js'))
			},
			{
				id: "/api/pwa/status",
				pattern: /^\/api\/pwa\/status\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/pwa/status/_server.ts.js'))
			},
			{
				id: "/api/theme",
				pattern: /^\/api\/theme\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/theme/_server.ts.js'))
			},
			{
				id: "/api/v1/[resource]",
				pattern: /^\/api\/v1\/([^/]+?)\/?$/,
				params: [{"name":"resource","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/v1/_resource_/_server.ts.js'))
			},
			{
				id: "/auth",
				pattern: /^\/auth\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 26 },
				endpoint: null
			},
			{
				id: "/auth/callback",
				pattern: /^\/auth\/callback\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/auth/callback/_server.ts.js'))
			},
			{
				id: "/billing",
				pattern: /^\/billing\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 27 },
				endpoint: null
			},
			{
				id: "/billing/checkout",
				pattern: /^\/billing\/checkout\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/billing/checkout/_server.ts.js'))
			},
			{
				id: "/billing/conta",
				pattern: /^\/billing\/conta\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 28 },
				endpoint: null
			},
			{
				id: "/billing/portal",
				pattern: /^\/billing\/portal\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/billing/portal/_server.ts.js'))
			},
			{
				id: "/billing/webhook/stripe",
				pattern: /^\/billing\/webhook\/stripe\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/billing/webhook/stripe/_server.ts.js'))
			},
			{
				id: "/(public)/blog",
				pattern: /^\/blog\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/(public)/blog/[slug]",
				pattern: /^\/blog\/([^/]+?)\/?$/,
				params: [{"name":"slug","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,3,], errors: [1,,], leaf: 18 },
				endpoint: null
			},
			{
				id: "/(public)/cancelamento",
				pattern: /^\/cancelamento\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 19 },
				endpoint: null
			},
			{
				id: "/(app)/dashboard",
				pattern: /^\/dashboard\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/(app)/documents",
				pattern: /^\/documents\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/(app)/expenses",
				pattern: /^\/expenses\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/files/[...key]",
				pattern: /^\/files(?:\/([^]*))?\/?$/,
				params: [{"name":"key","optional":false,"rest":true,"chained":true}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/files/_...key_/_server.ts.js'))
			},
			{
				id: "/(app)/fuel",
				pattern: /^\/fuel\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/(app)/garage",
				pattern: /^\/garage\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/healthz",
				pattern: /^\/healthz\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/healthz/_server.ts.js'))
			},
			{
				id: "/(public)/lgpd",
				pattern: /^\/lgpd\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 20 },
				endpoint: null
			},
			{
				id: "/(app)/maintenance",
				pattern: /^\/maintenance\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/manifest.webmanifest",
				pattern: /^\/manifest\.webmanifest\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/manifest.webmanifest/_server.ts.js'))
			},
			{
				id: "/offline",
				pattern: /^\/offline\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 29 },
				endpoint: null
			},
			{
				id: "/onboarding",
				pattern: /^\/onboarding\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 30 },
				endpoint: null
			},
			{
				id: "/(public)/politica",
				pattern: /^\/politica\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 21 },
				endpoint: null
			},
			{
				id: "/(public)/precos",
				pattern: /^\/precos\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 22 },
				endpoint: null
			},
			{
				id: "/(app)/reminders",
				pattern: /^\/reminders\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/(app)/reports",
				pattern: /^\/reports\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/(public)/reports/sale/public/[token]",
				pattern: /^\/reports\/sale\/public\/([^/]+?)\/?$/,
				params: [{"name":"token","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,3,], errors: [1,,], leaf: 23 },
				endpoint: null
			},
			{
				id: "/(app)/reports/sale/[motorcycleId]",
				pattern: /^\/reports\/sale\/([^/]+?)\/?$/,
				params: [{"name":"motorcycleId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/(public)/roadmap",
				pattern: /^\/roadmap\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 24 },
				endpoint: null
			},
			{
				id: "/sw.js",
				pattern: /^\/sw\.js\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/sw.js/_server.ts.js'))
			},
			{
				id: "/(public)/termos",
				pattern: /^\/termos\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 25 },
				endpoint: null
			},
			{
				id: "/(app)/tires",
				pattern: /^\/tires\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/(app)/trabalho",
				pattern: /^\/trabalho\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/(app)/[feature]/export.csv",
				pattern: /^\/([^/]+?)\/export\.csv\/?$/,
				params: [{"name":"feature","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/(app)/_feature_/export.csv/_server.ts.js'))
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
