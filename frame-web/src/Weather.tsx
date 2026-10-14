import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react';
import type { Weather as WeatherData } from '@homecontrol/contracts/frame-schema';
import { getWeather } from './api-client.js';
import { getDayKey } from './calendar/schedule.js';

function getCondition(code: number | null, isDay: boolean) {
  if (code === 0)
    return {
      label: isDay ? 'Clear skies' : 'Clear night',
      Icon: isDay ? Sun : Moon,
    };
  if (code === 1 || code === 2)
    return { label: 'Partly cloudy', Icon: CloudSun };
  if (code === 3) return { label: 'Overcast', Icon: Cloud };
  if (code === 45 || code === 48) return { label: 'Foggy', Icon: CloudFog };
  if (code !== null && code >= 51 && code <= 57)
    return { label: 'Drizzle', Icon: CloudDrizzle };
  if (
    code !== null &&
    ((code >= 71 && code <= 77) || code === 85 || code === 86)
  )
    return { label: 'Snow', Icon: CloudSnow };
  if (code !== null && code >= 95)
    return { label: 'Thunderstorms', Icon: CloudLightning };
  if (code !== null && code >= 61) return { label: 'Rain', Icon: CloudRain };
  return { label: 'Weather unavailable', Icon: Cloud };
}
export function Weather({
  token,
  timezone,
}: {
  token: string;
  timezone: string;
}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const result = await getWeather(token);
        if (active) {
          setWeather(result);
          setOffline(false);
        }
      } catch {
        if (active) setOffline(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token]);
  const { label, Icon } = getCondition(
    weather?.weatherCode ?? null,
    weather?.isDay ?? true,
  );
  const unitName = weather?.unit === 'fahrenheit' ? 'Fahrenheit' : 'Celsius';
  const unitSymbol = weather?.unit === 'fahrenheit' ? 'F' : 'C';
  let currentLabel = label;
  if (offline) currentLabel = 'Weather offline';
  else if (weather?.state === 'stale') currentLabel = 'Last known weather';
  const temperature =
    weather?.temperature != null && !offline
      ? `${Math.round(weather.temperature)}°`
      : '—';
  const forecast =
    !offline && weather?.state === 'ready'
      ? weather.forecast.filter(
          (day) =>
            day.date > getDayKey(new Date(), weather.timezone || timezone),
        )
      : [];

  if (weather?.state === 'disabled') return null;
  return (
    <section
      className="weather-panel"
      aria-label={`${weather?.label || 'Local'} weather and five-day forecast`}
    >
      <div className="weather-current">
        <span className="weather-summary">Now · {currentLabel}</span>
        <span className="weather-location">
          {weather?.label || 'Choose a location in HomeControl'}
        </span>
      </div>
      <div className="weather-forecast">
        <div
          className="forecast-day forecast-today"
          aria-label={`Today: ${currentLabel}, ${temperature} ${unitName} now`}
        >
          <span>Today</span>
          <Icon size={30} aria-hidden="true" />
          <div>
            <strong>
              {temperature}
              <small>{unitSymbol}</small>
            </strong>
          </div>
        </div>
        {forecast.map((day) => {
          const { Icon: DayIcon, label: dayLabel } = getCondition(
            day.weatherCode,
            true,
          );
          return (
            <div
              className="forecast-day"
              key={day.date}
              aria-label={`${day.date}: ${dayLabel}, high ${Math.round(day.high)}, low ${Math.round(day.low)} degrees ${unitName}`}
            >
              <span>
                {new Intl.DateTimeFormat('en', {
                  weekday: 'short',
                  timeZone: 'UTC',
                }).format(new Date(`${day.date}T12:00:00Z`))}
              </span>
              <DayIcon size={30} aria-hidden="true" />
              <div>
                <strong>{Math.round(day.high)}°</strong>
                <span>{Math.round(day.low)}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
