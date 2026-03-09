'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
  isBefore,
  isAfter,
  isWithinInterval,
  startOfDay,
} from 'date-fns';
import * as Popover from '@radix-ui/react-popover';

interface DatePickerProps {
  checkIn: string;
  checkOut: string;
  onSelect: (checkIn: string, checkOut: string) => void;
  labelCheckIn: string;
  labelCheckOut: string;
}

export function DatePicker({
  checkIn,
  checkOut,
  onSelect,
  labelCheckIn,
  labelCheckOut,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const today = startOfDay(new Date());
  const checkInDate = useMemo(() => (checkIn ? new Date(checkIn) : null), [checkIn]);
  const checkOutDate = useMemo(() => (checkOut ? new Date(checkOut) : null), [checkOut]);

  const handleDateClick = useCallback(
    (date: Date) => {
      if (!selectingEnd || !checkInDate) {
        // Selecting check-in
        onSelect(format(date, 'yyyy-MM-dd'), '');
        setSelectingEnd(true);
      } else {
        // Selecting check-out
        if (isBefore(date, checkInDate) || isSameDay(date, checkInDate)) {
          // Clicked before check-in, restart
          onSelect(format(date, 'yyyy-MM-dd'), '');
          setSelectingEnd(true);
        } else {
          onSelect(checkIn, format(date, 'yyyy-MM-dd'));
          setSelectingEnd(false);
          setOpen(false);
        }
      }
    },
    [selectingEnd, checkInDate, checkIn, onSelect],
  );

  const nextMonth = addMonths(currentMonth, 1);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-3 w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm hover:border-slate-400 dark:hover:border-slate-600 transition-colors text-left"
        >
          <span className="material-icons text-slate-400 text-lg">date_range</span>
          <div className="flex gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                {labelCheckIn}
              </div>
              <div className="font-medium text-slate-900 dark:text-white">
                {checkIn ? format(new Date(checkIn), 'dd MMM yyyy') : '—'}
              </div>
            </div>
            <span className="text-slate-300 dark:text-slate-600 self-center">→</span>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                {labelCheckOut}
              </div>
              <div className="font-medium text-slate-900 dark:text-white">
                {checkOut ? format(new Date(checkOut), 'dd MMM yyyy') : '—'}
              </div>
            </div>
          </div>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 bg-white dark:bg-[#1a2632] rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4"
          sideOffset={8}
          align="start"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <CalendarMonth
              month={currentMonth}
              today={today}
              checkIn={checkInDate}
              checkOut={checkOutDate}
              hoverDate={hoverDate}
              selectingEnd={selectingEnd}
              onDateClick={handleDateClick}
              onHover={setHoverDate}
              onPrev={() => setCurrentMonth(addMonths(currentMonth, -1))}
              showPrev
            />
            <CalendarMonth
              month={nextMonth}
              today={today}
              checkIn={checkInDate}
              checkOut={checkOutDate}
              hoverDate={hoverDate}
              selectingEnd={selectingEnd}
              onDateClick={handleDateClick}
              onHover={setHoverDate}
              onNext={() => setCurrentMonth(addMonths(currentMonth, 1))}
              showNext
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface CalendarMonthProps {
  month: Date;
  today: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  hoverDate: Date | null;
  selectingEnd: boolean;
  onDateClick: (date: Date) => void;
  onHover: (date: Date | null) => void;
  onPrev?: () => void;
  onNext?: () => void;
  showPrev?: boolean;
  showNext?: boolean;
}

function CalendarMonth({
  month,
  today,
  checkIn,
  checkOut,
  hoverDate,
  selectingEnd,
  onDateClick,
  onHover,
  onPrev,
  onNext,
  showPrev,
  showNext,
}: CalendarMonthProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const daysArr: Date[] = [];
    let d = start;
    while (d <= end) {
      daysArr.push(d);
      d = addDays(d, 1);
    }
    return daysArr;
  }, [month]);

  const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div className="w-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        {showPrev ? (
          <button
            type="button"
            onClick={onPrev}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span className="material-icons text-slate-500 text-lg">chevron_left</span>
          </button>
        ) : (
          <div className="w-7" />
        )}
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {format(month, 'MMMM yyyy')}
        </span>
        {showNext ? (
          <button
            type="button"
            onClick={onNext}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span className="material-icons text-slate-500 text-lg">chevron_right</span>
          </button>
        ) : (
          <div className="w-7" />
        )}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const isPast = isBefore(day, today);
          const disabled = !inMonth || isPast;

          const isCheckIn = checkIn ? isSameDay(day, checkIn) : false;
          const isCheckOut = checkOut ? isSameDay(day, checkOut) : false;

          // Determine if in range
          const rangeEnd = checkOut ?? (selectingEnd && hoverDate && checkIn && isAfter(hoverDate, checkIn) ? hoverDate : null);
          const inRange =
            checkIn && rangeEnd && !isCheckIn && !isCheckOut
              ? isWithinInterval(day, { start: checkIn, end: rangeEnd })
              : false;

          let className =
            'h-9 w-9 mx-auto flex items-center justify-center text-sm rounded-full transition-colors ';

          if (disabled) {
            className += 'text-slate-300 dark:text-slate-600 cursor-default';
          } else if (isCheckIn || isCheckOut) {
            className += 'bg-primary text-white font-bold cursor-pointer';
          } else if (inRange) {
            className += 'bg-primary/10 text-primary font-medium cursor-pointer';
          } else {
            className +=
              'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer';
          }

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onDateClick(day)}
              onMouseEnter={() => !disabled && onHover(day)}
              onMouseLeave={() => onHover(null)}
              className={className}
            >
              {inMonth ? format(day, 'd') : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
