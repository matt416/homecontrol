import { ReminderStrip } from './reminders/ReminderStrip.js';
import { useReminders } from './reminders/use-reminders.js';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type CSSProperties,
} from 'react';
import { Pairing } from './Pairing.js';
import { useDashboard } from './use-dashboard.js';
import { Calendar } from './calendar/Calendar.js';
import { PhotoFrame } from './photos/PhotoFrame.js';
import { usePhotoSettings } from './photos/use-photo-settings.js';
import { Weather } from './Weather.js';
import { watchForUpdates } from './watch-for-updates.js';

const TOKEN_KEY = 'homeframe-token';

function Frame({ token, onUnpair }: { token: string; onUnpair: () => void }) {
  const { data, error, refreshing, refresh } = useDashboard(token, onUnpair);
  const reminders = useReminders(token);
  const photoSettings = usePhotoSettings(token);
  const [now, setNow] = useState(() => new Date());
  const [screenError, setScreenError] = useState('');
  const [photosPaused, setPhotosPaused] = useState(false);
  const [calendarBrowsing, setCalendarBrowsing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useRef<HTMLDialogElement>(null);
  const taps = useRef({ count: 0, time: 0, x: 0, y: 0 });
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  function openSettings() {
    setSettingsOpen(true);
    settings.current?.showModal();
  }
  function countTap(event: PointerEvent<HTMLElement>) {
    if (settingsOpen || !event.isPrimary || event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, dialog'))
      return;
    const time = performance.now();
    if (
      time - touchStart.current.time > 500 ||
      Math.hypot(
        event.clientX - touchStart.current.x,
        event.clientY - touchStart.current.y,
      ) > 25
    ) {
      taps.current.count = 0;
      return;
    }
    const previous = taps.current;
    const nearby =
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 50;
    const count = time - previous.time < 400 && nearby ? previous.count + 1 : 1;
    taps.current = { count, time, x: event.clientX, y: event.clientY };
    if (count === 3) {
      taps.current.count = 0;
      openSettings();
    }
  }
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!data)
    return (
      <main className="loading-screen">
        <img src="/homecontrol.png" alt="" width="76" height="76" />
        <h1>Connecting to HomeControl</h1>
        {error && <p role="status">{error}</p>}
        <button
          onClick={() => {
            void refresh();
          }}
        >
          Try again
        </button>
        <button onClick={onUnpair}>Disconnect</button>
      </main>
    );
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setScreenError('Full screen is not available in this browser.');
    }
  }
  const appearance: CSSProperties & { '--accent': string } = {
    '--accent': data.accentColor ?? '#E4FF73',
  };
  return (
    <main
      className="frame-shell"
      style={appearance}
      onPointerDownCapture={(event) => {
        touchStart.current = {
          x: event.clientX,
          y: event.clientY,
          time: performance.now(),
        };
      }}
      onPointerUpCapture={countTap}
    >
      <button className="settings-shortcut" onClick={openSettings}>
        Settings
      </button>
      <dialog
        ref={settings}
        className="frame-settings"
        aria-labelledby="settings-title"
        onClose={() => setSettingsOpen(false)}
      >
        <h2 id="settings-title">Settings</h2>
        <button
          disabled={refreshing}
          onClick={() => {
            void refresh();
          }}
        >
          Refresh
        </button>
        <button
          onClick={() => {
            void fullscreen();
          }}
        >
          Full screen
        </button>
        <button onClick={() => setPhotosPaused((value) => !value)}>
          {photosPaused ? 'Play slideshow' : 'Pause slideshow'}
        </button>
        <button onClick={onUnpair}>Disconnect</button>
        <p className="reminder-settings-note">
          Manage trash collection in HomeControl on your Mac → Collection day.
        </p>
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Weather by Open-Meteo
        </a>
        <a href="/licenses.txt" target="_blank" rel="noreferrer">
          Open-source licences
        </a>
        <button autoFocus onClick={() => settings.current?.close()}>
          Done
        </button>
      </dialog>
      {(error || screenError) && (
        <p className="connection-alert" role="alert">
          {error || screenError}
        </p>
      )}
      <div className="frame-grid">
        <PhotoFrame
          settings={photoSettings}
          photos={data.photos}
          photoStatus={data.photoStatus}
          token={token}
          paused={photosPaused}
        />
        <div className="schedule-pane">
          <Calendar
            token={token}
            calendarRevision={data.calendarRevision}
            timezone={data.timezone}
            calendarStatus={data.calendarStatus}
            now={now}
            onBrowsingChange={setCalendarBrowsing}
            clockActions={
              <div
                className={`clock-collection ${calendarBrowsing ? 'is-browsing' : ''}`}
                aria-hidden={calendarBrowsing}
              >
                {reminders.state && (
                  <ReminderStrip
                    state={reminders.state}
                    now={now}
                    timezone={data.timezone}
                  />
                )}
                {reminders.error && (
                  <p className="reminder-action-error" role="status">
                    {reminders.error}
                  </p>
                )}
              </div>
            }
          />
          <div
            className={`schedule-details ${calendarBrowsing ? 'is-browsing' : ''}`}
            aria-hidden={calendarBrowsing}
            inert={calendarBrowsing}
          >
            <Weather token={token} timezone={data.timezone} />
          </div>
        </div>
      </div>
    </main>
  );
}

export function App() {
  useEffect(() => watchForUpdates(), []);
  const [token, setToken] = useState(
    () =>
      localStorage.getItem(TOKEN_KEY) ??
      sessionStorage.getItem(TOKEN_KEY) ??
      '',
  );
  const unpair = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
  }, []);
  function pair(value: string, remember: boolean) {
    sessionStorage.setItem(TOKEN_KEY, value);
    if (remember) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
    setToken(value);
  }
  return token ? (
    <Frame key={token} token={token} onUnpair={unpair} />
  ) : (
    <Pairing onPair={pair} />
  );
}
