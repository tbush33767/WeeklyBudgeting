import { format, startOfWeek, endOfWeek } from 'date-fns';
import './WeekNavigation.css';

export default function WeekNavigation({ currentDate, onPrevWeek, onNextWeek, onToday }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 5 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 5 });
  
  const isCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 5 }).getTime() === weekStart.getTime();

  return (
    <div className="week-navigation">
      <button className="nav-btn" onClick={onPrevWeek} title="Previous week">
        <span className="material-symbols-rounded">chevron_left</span>
      </button>
      
      <div className="week-display">
        <span className="material-symbols-rounded">date_range</span>
        <span className="week-dates">
          {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
        </span>
        {isCurrentWeek && <span className="current-badge">This Week</span>}
      </div>
      
      <button className="nav-btn" onClick={onNextWeek} title="Next week">
        <span className="material-symbols-rounded">chevron_right</span>
      </button>
      
      <div className="today-btn-container">
        {!isCurrentWeek && (
          <button className="today-btn" onClick={onToday} title="Go to current week">
            <span className="material-symbols-rounded">today</span>
            Today
          </button>
        )}
      </div>
    </div>
  );
}

