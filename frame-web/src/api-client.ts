import { z } from 'zod';
import { reminderStateSchema } from '@homecontrol/contracts/reminders';
import { photoSettingsSchema } from '@homecontrol/contracts/photo-settings';
import {
  dashboardSchema,
  calendarMonthSchema,
  weatherSchema,
} from '@homecontrol/contracts/frame-schema';

export class PairingError extends Error {}

export async function request<T>(
  path: string,
  token: string,
  readBody: (response: Response) => Promise<T>,
  signal?: AbortSignal,
  mutation?: { method: 'POST'; body: unknown },
): Promise<T> {
  // The frame's WebView 106 lacks AbortSignal.any/timeout. Keep cancellation
  // active through the response body, including slow photo downloads.
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(abort, 10_000);
  try {
    const response = await fetch(path, {
      method: mutation?.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(mutation ? { 'Content-Type': 'application/json' } : {}),
      },
      body: mutation ? JSON.stringify(mutation.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (response.status === 401)
      throw new PairingError('That pairing token was not accepted.');
    if (!response.ok)
      throw new Error('The Mac could not complete this request.');
    return await readBody(response);
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
export async function getDashboard(token: string) {
  return dashboardSchema.parse(
    await request('/api/dashboard', token, (response) => response.json()),
  );
}
export async function getPhotoSettings(token: string, signal: AbortSignal) {
  return photoSettingsSchema.parse(
    await request(
      '/api/photo-settings',
      token,
      (response) => response.json(),
      signal,
    ),
  );
}
export async function getPhotoBlob(
  id: string,
  token: string,
  signal: AbortSignal,
) {
  return request(
    `/api/photos/${encodeURIComponent(id)}`,
    token,
    (response) => response.blob(),
    signal,
  );
}
export async function getWeather(token: string) {
  return weatherSchema.parse(
    await request('/api/weather', token, (response) => response.json()),
  );
}

export async function getCalendarMonth(
  month: string,
  token: string,
  signal: AbortSignal,
) {
  return calendarMonthSchema.parse(
    await request(
      `/api/calendar/${month}`,
      token,
      (response) => response.json(),
      signal,
    ),
  );
}

export async function getReminders(token: string) {
  return reminderStateSchema.parse(
    await request('/api/reminders', token, (response) => response.json()),
  );
}

export async function exchangePairingCode(code: string) {
  const response = await fetch('/api/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    cache: 'no-store',
  });
  if (response.status === 429)
    throw new PairingError(
      'Too many attempts. Wait one minute, then try again.',
    );
  if (!response.ok)
    throw new PairingError(
      'That code was not accepted. Get a new code in HomeControl on your Mac.',
    );
  return z
    .object({ token: z.string().min(32).max(1024) })
    .parse(await response.json()).token;
}
