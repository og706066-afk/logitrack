export const LOGIN_DELAY_MS = 1000;
export const ACTION_DELAY_MS = 600;

export const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export function friendlyActionError(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code || '';
  const message = error instanceof Error ? error.message : '';
  if (code === 'permission-denied' || message.toLowerCase().includes('insufficient permissions')) {
    return 'Anda tidak memiliki izin untuk melakukan aksi ini.';
  }
  return message || fallback;
}
