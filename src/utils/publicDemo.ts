// The portal is open access by default: visitors land straight in the workspace
// with no sign-in or registration screen. Set VITE_PUBLIC_DEMO_MODE=false to
// restore the gated, account-based experience.
export const isPublicDemoMode = import.meta.env.VITE_PUBLIC_DEMO_MODE !== 'false';

export function publicAssetUrl(path: string): string {
  const assetPath = path.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}${assetPath}`;
}
