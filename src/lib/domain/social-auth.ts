export const SOCIAL_AUTH_PROVIDERS = ["google", "apple"] as const;
export type SocialAuthProvider = (typeof SOCIAL_AUTH_PROVIDERS)[number];
