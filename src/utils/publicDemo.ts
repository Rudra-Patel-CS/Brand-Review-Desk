export const isPublicDemoMode = import.meta.env.VITE_PUBLIC_DEMO_MODE === 'true';

export function publicAssetUrl(path: string): string {
  const assetPath = path.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}${assetPath}`;
}
