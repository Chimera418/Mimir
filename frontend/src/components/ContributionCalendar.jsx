import { useState, useMemo } from 'react';
import { GitCommit, Flame, Calendar, Award } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = [
  { index: 1, label: 'Mon' },
  { index: 3, label: 'Wed' },
  { index: 5, label: 'Fri' },
];

const COLOR_LEVELS = [
  { bg: '#161b22', border: 'rgba(255, 255, 255, 0.05)' }, // Level 0: 0
  { bg: '#0e4429', border: 'rgba(0, 230, 153, 0.2)' },     // Level 1: 1-2
  { bg: '#006d32', border: 'rgba(0, 230, 153, 0.35)' },    // Level 2: 3-5
  { bg: '#26a641', border: 'rgba(0, 230, 153, 0.5)' },     // Level 3: 6-9
  { bg: '#39d353', border: 'rgba(0, 255, 170, 0.7)' },     // Level 4: 10+
];

const getLevel = (count) => {
  if (!count || count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
};

const formatDateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (dateObj) => {
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const ContributionCalendar = ({ contributions = [], username }) => {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  // Map of date string 'YYYY-MM-DD' -> count
  const countMap = useMemo(() => {
    const map = {};
    (contributions || []).forEach((item) => {
      if (item && item.date) {
        const key = item.date.slice(0, 10);
        map[key] = (map[key] || 0) + item.count;
      }
    });
    return map;
  }, [contributions]);

  const totalContributions = useMemo(() => {
    return (contributions || []).reduce((sum, item) => sum + (item.count || 0), 0);
  }, [contributions]);

  // Generate 53 weeks ending with current week
  const { weeks, monthLabels, stats } = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayDayOfWeek = today.getDay(); // 0 is Sun, 6 is Sat

    // Start on Sunday 52 weeks prior
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (52 * 7 + todayDayOfWeek));
    startDate.setHours(0, 0, 0, 0);

    const weeksData = [];
    const months = [];
    let curDate = new Date(startDate);
    let lastLabeledCol = -10;
    let lastMonth = -1;

    let activeDays = 0;
    let maxInOneDay = 0;
    let maxDate = null;
    let streak = 0;
    let longestStreak = 0;
    let currentStreak = 0;

    for (let w = 0; w < 53; w++) {
      const days = [];
      let weekContainsFirstOfMonth = false;
      let firstOfMonthMonth = -1;

      for (let d = 0; d < 7; d++) {
        const thisDay = new Date(curDate);
        const dateKey = formatDateKey(thisDay);
        const isFuture = thisDay > today;
        const count = isFuture ? 0 : (countMap[dateKey] || 0);

        if (!isFuture) {
          if (count > 0) {
            activeDays++;
            streak++;
            if (streak > longestStreak) longestStreak = streak;
            if (count > maxInOneDay) {
              maxInOneDay = count;
              maxDate = dateKey;
            }
          } else {
            streak = 0;
          }
        }

        if (thisDay.getDate() === 1 || (w === 0 && d === 0)) {
          weekContainsFirstOfMonth = true;
          firstOfMonthMonth = thisDay.getMonth();
        }

        days.push({
          date: thisDay,
          dateKey,
          count,
          level: getLevel(count),
          isFuture,
          dayOfWeek: d,
        });

        curDate.setDate(curDate.getDate() + 1);
      }

      // Check if we should place a month label for this week
      if (weekContainsFirstOfMonth && firstOfMonthMonth !== lastMonth && (w - lastLabeledCol >= 3 || w === 0)) {
        months.push({
          colIndex: w,
          label: MONTH_NAMES[firstOfMonthMonth],
        });
        lastMonth = firstOfMonthMonth;
        lastLabeledCol = w;
      }

      weeksData.push(days);
    }

    // Calculate current streak ending today or yesterday
    let checkDate = new Date(today);
    let tempCurrentStreak = 0;
    const todayKey = formatDateKey(checkDate);
    if (!countMap[todayKey]) {
      // check yesterday if today has no commits yet
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (true) {
      const key = formatDateKey(checkDate);
      if (countMap[key] && countMap[key] > 0) {
        tempCurrentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    currentStreak = tempCurrentStreak;

    return {
      weeks: weeksData,
      monthLabels: months,
      stats: {
        activeDays,
        maxInOneDay,
        maxDate,
        longestStreak,
        currentStreak,
      },
    };
  }, [countMap]);

  // SVG layout dimensions
  const cellSize = 11;
  const cellGap = 3;
  const colPitch = cellSize + cellGap; // 14px
  const rowPitch = cellSize + cellGap; // 14px
  const xOffset = 34; // space for day labels on left
  const yOffset = 22; // space for month labels on top

  const svgWidth = xOffset + 53 * colPitch + 10; // ~786px
  const svgHeight = yOffset + 7 * rowPitch + 12; // ~132px

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 select-none transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-dark-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <GitCommit size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <span>{totalContributions.toLocaleString()} contributions in the last year</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Across all commits authored by <span className="text-gray-300 font-mono">@{username}</span>
            </p>
          </div>
        </div>

        {/* Quick stat badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {stats.currentStreak > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
              <Flame size={13} className="text-amber-400 animate-pulse" />
              {stats.currentStreak} day streak
            </span>
          )}
          {stats.longestStreak > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <Award size={13} />
              Best: {stats.longestStreak} days
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-dark-700 border border-dark-600 text-gray-400 text-xs">
            <Calendar size={13} />
            {stats.activeDays} active day{stats.activeDays !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Calendar SVG Grid Container */}
      <div className="relative overflow-x-auto overflow-y-hidden pb-1 pt-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[750px] font-mono text-[10px]"
          style={{ maxHeight: '150px' }}
        >
          {/* Month labels */}
          {monthLabels.map((m, idx) => (
            <text
              key={`m-${idx}`}
              x={xOffset + m.colIndex * colPitch}
              y={14}
              fill="oklch(60% 0 0)"
              fontSize="10"
              fontWeight="500"
              textAnchor="start"
            >
              {m.label}
            </text>
          ))}

          {/* Day of week labels (Mon, Wed, Fri) */}
          {DAY_LABELS.map((d) => (
            <text
              key={`d-${d.index}`}
              x={xOffset - 8}
              y={yOffset + d.index * rowPitch + cellSize - 2}
              fill="oklch(50% 0 0)"
              fontSize="9"
              textAnchor="end"
            >
              {d.label}
            </text>
          ))}

          {/* Day cells (53 columns x 7 rows) */}
          {weeks.map((week, colIdx) => (
            <g key={`col-${colIdx}`} transform={`translate(${xOffset + colIdx * colPitch}, ${yOffset})`}>
              {week.map((day) => {
                if (day.isFuture) return null; // do not render days in the future

                const color = COLOR_LEVELS[day.level];
                const isHovered = hoveredCell && hoveredCell.dateKey === day.dateKey;
                const isSelected = selectedCell && selectedCell.dateKey === day.dateKey;

                return (
                  <rect
                    key={day.dateKey}
                    x={0}
                    y={day.dayOfWeek * rowPitch}
                    width={cellSize}
                    height={cellSize}
                    rx={2}
                    ry={2}
                    fill={color.bg}
                    stroke={isSelected ? '#38bdf8' : isHovered ? 'var(--color-accent)' : color.border}
                    strokeWidth={isSelected || isHovered ? 1.5 : 1}
                    className="cursor-pointer transition-colors duration-100"
                    onMouseEnter={(e) => {
                      const rect = e.target.getBoundingClientRect();
                      setHoveredCell({
                        ...day,
                        clientRect: rect,
                      });
                    }}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => {
                      if (selectedCell?.dateKey === day.dateKey) {
                        setSelectedCell(null);
                      } else {
                        setSelectedCell(day);
                      }
                    }}
                  >
                    <title>
                      {day.count === 0 ? 'No contributions' : `${day.count} contribution${day.count !== 1 ? 's' : ''}`}{' '}
                      on {formatDisplayDate(day.date)}
                    </title>
                  </rect>
                );
              })}
            </g>
          ))}
        </svg>

        {/* Floating Custom Tooltip */}
        {hoveredCell && (
          <div
            className="pointer-events-none absolute z-20 px-2.5 py-1.5 rounded bg-dark-900 border border-dark-600 text-white text-xs shadow-xl whitespace-nowrap transform -translate-x-1/2 -translate-y-full transition-all"
            style={{
              left: `${Math.min(
                Math.max(
                  xOffset +
                    weeks.findIndex((w) => w.some((d) => d.dateKey === hoveredCell.dateKey)) * colPitch +
                    colPitch / 2,
                  60
                ),
                svgWidth - 60
              )}px`,
              top: `${Math.max(yOffset + hoveredCell.dayOfWeek * rowPitch - 6, 2)}px`,
            }}
          >
            <div className="font-semibold text-white">
              {hoveredCell.count === 0 ? (
                <span className="text-gray-400">No contributions</span>
              ) : (
                <span className="text-emerald-400">
                  {hoveredCell.count} contribution{hoveredCell.count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-400">{formatDisplayDate(hoveredCell.date)}</div>
          </div>
        )}
      </div>

      {/* Selected Day Info Card (if clicked) */}
      {selectedCell && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-dark-700/60 border border-dark-600 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span className="text-white font-medium">{formatDisplayDate(selectedCell.date)}</span>
            <span className="text-gray-400">•</span>
            <span className={selectedCell.count > 0 ? 'text-emerald-400 font-semibold' : 'text-gray-400'}>
              {selectedCell.count === 0 ? '0 commits' : `${selectedCell.count} commit${selectedCell.count !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={() => setSelectedCell(null)}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer text-[11px] underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Footer: Activity note + Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-dark-700/60 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>Learn how we count contributions</span>
          {stats.maxInOneDay > 0 && stats.maxDate && (
            <span className="hidden sm:inline text-gray-400">
              Busy day: <strong className="text-emerald-400 font-mono">{stats.maxInOneDay}</strong> commits on{' '}
              {stats.maxDate}
            </span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] mr-1">Less</span>
          {COLOR_LEVELS.map((col, idx) => (
            <div
              key={`legend-${idx}`}
              className="w-3 h-3 rounded-[2px]"
              style={{
                backgroundColor: col.bg,
                border: `1px solid ${col.border}`,
              }}
              title={
                idx === 0
                  ? '0 contributions'
                  : idx === 1
                  ? '1-2 contributions'
                  : idx === 2
                  ? '3-5 contributions'
                  : idx === 3
                  ? '6-9 contributions'
                  : '10+ contributions'
              }
            />
          ))}
          <span className="text-[11px] ml-1">More</span>
        </div>
      </div>
    </div>
  );
};

export default ContributionCalendar;

