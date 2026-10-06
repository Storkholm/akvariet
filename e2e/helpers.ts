import type { Page } from '@playwright/test';

export const TABLET = { width: 1180, height: 820 };
export const PHONE = { width: 390, height: 844 };

/** Wait until the Three.js aquarium has rendered a few frames. */
export async function waitForAquarium(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const a = (window as unknown as { aquarium?: { time: number } }).aquarium;
      return !!a && a.time > 0.3;
    },
    undefined,
    { timeout: 30_000 },
  );
}
