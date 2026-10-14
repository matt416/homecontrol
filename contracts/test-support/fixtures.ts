import type { FrameEvent, Snapshot } from '../frame-schema.js';

export function createEvent(overrides: Partial<FrameEvent> = {}): FrameEvent {
  return {
    id: 'event-1',
    title: 'Family dinner',
    calendar: 'Family',
    start: '2026-10-12T18:00:00-04:00',
    end: '2026-10-12T19:00:00-04:00',
    allDay: false,
    startDay: '2026-10-12',
    endDay: '2026-10-12',
    ...overrides,
  };
}
export function createSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    calendarStatus: { state: 'ready', message: 'Exported' },
    photoStatus: { state: 'ready', message: 'Exported' },
    events: [createEvent()],
    photos: [{ id: 'photo-1', album: 'Test album', caption: 'Test photo' }],
    ...overrides,
  };
}
