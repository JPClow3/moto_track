// in dev, this makes Vite inject its client as this module's first dependency,
// so that global constant replacements are installed before any other module
// (including user hooks) evaluates. In build it's inert.
import.meta.hot;




export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21'),
	() => import('./nodes/22'),
	() => import('./nodes/23'),
	() => import('./nodes/24'),
	() => import('./nodes/25'),
	() => import('./nodes/26'),
	() => import('./nodes/27'),
	() => import('./nodes/28'),
	() => import('./nodes/29'),
	() => import('./nodes/30')
];

export const server_loads = [2];

export const dictionary = {
		"/": [4],
		"/(app)/admin": [~5,[2]],
		"/auth": [~26],
		"/billing": [~27],
		"/billing/conta": [~28],
		"/(public)/blog": [~17,[3]],
		"/(public)/blog/[slug]": [~18,[3]],
		"/(public)/cancelamento": [19,[3]],
		"/(app)/dashboard": [~6,[2]],
		"/(app)/documents": [~7,[2]],
		"/(app)/expenses": [~8,[2]],
		"/(app)/fuel": [~9,[2]],
		"/(app)/garage": [~10,[2]],
		"/(public)/lgpd": [20,[3]],
		"/(app)/maintenance": [~11,[2]],
		"/offline": [29],
		"/onboarding": [~30],
		"/(public)/politica": [21,[3]],
		"/(public)/precos": [22,[3]],
		"/(app)/reminders": [~12,[2]],
		"/(app)/reports": [~13,[2]],
		"/(public)/reports/sale/public/[token]": [~23,[3]],
		"/(app)/reports/sale/[motorcycleId]": [~14,[2]],
		"/(public)/roadmap": [24,[3]],
		"/(public)/termos": [25,[3]],
		"/(app)/tires": [~15,[2]],
		"/(app)/trabalho": [~16,[2]]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';

export const get_error_template = () => import('../shared/error-template.js').then(m => m.default);