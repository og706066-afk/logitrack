export const LOGIN_DELAY_MS = 1000;
export const ACTION_DELAY_MS = 600;

export const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
