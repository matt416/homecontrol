import { Leaf, Recycle, ShoppingBag, Trash2 } from 'lucide-react';
import {
  getDueReminders,
  type BinType,
  type ReminderState,
} from '@homecontrol/contracts/reminders';
import './reminders.css';

const BIN_LABELS: Record<BinType, string> = {
  recycling: 'Recycling',
  trash: 'Trash',
  green: 'Green bin',
  brown: 'Brown bags',
};
const BIN_ICONS = {
  recycling: Recycle,
  trash: Trash2,
  green: Leaf,
  brown: ShoppingBag,
};
export function ReminderStrip({
  state,
  now,
  timezone,
}: {
  state: ReminderState;
  now: Date;
  timezone: string;
}) {
  const due = getDueReminders(state, now, timezone);
  if (!due.bins.length) return null;
  return (
    <aside className="reminder-strip" aria-label="Household reminders">
      {due.bins.length > 0 && (
        <div className="bin-reminders">
          <span className="reminder-timing">{due.binTiming}</span>
          {due.bins.map((bin) => {
            const Icon = BIN_ICONS[bin];
            const label = `${BIN_LABELS[bin]} collection — ${due.binTiming}`;
            return (
              <span
                key={bin}
                className={`reminder-symbol bin-${bin}`}
                role="img"
                aria-label={label}
                title={label}
              >
                <Icon size={30} strokeWidth={1.8} aria-hidden="true" />
              </span>
            );
          })}
        </div>
      )}
    </aside>
  );
}
