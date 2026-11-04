import {
  addAndRoundBookingTime,
  addMinutesIso,
  findClosestDuration,
  formatTime,
  generateTimeOptions,
  minutesBetween,
} from './date-helpers';

describe('date-helpers', () => {
  describe('generateTimeOptions', () => {
    it('rounds up when the 30-minute threshold falls just after a slot boundary', () => {
      jasmine.clock().install();
      const now = new Date(2026, 9, 17, 10, 0, 1);
      jasmine.clock().mockDate(now);
      const date = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      try {
        const options = generateTimeOptions(date);

        expect(options[0]).toBe('11:00');
        expect(options).not.toContain('10:30');
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('allows a slot exactly 30 minutes ahead', () => {
      jasmine.clock().install();
      const now = new Date(2026, 9, 17, 10, 0, 0);
      jasmine.clock().mockDate(now);
      const date = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      try {
        const options = generateTimeOptions(date);

        expect(options[0]).toBe('10:30');
      } finally {
        jasmine.clock().uninstall();
      }
    });
  });

  describe('addAndRoundBookingTime', () => {
    it('rounds a 30-minute lead time up to a 15-minute boundary', () => {
      const start = new Date(2026, 9, 17, 10, 0, 1).toISOString();

      expect(formatTime(addAndRoundBookingTime(start))).toBe('10:45');
    });
  });

  describe('addMinutesIso', () => {
    const cases: { name: string; input: string; minutes: number; expected: string }[] = [
      {
        name: 'adds minutes within the same hour',
        input: '2026-10-17T12:00:00.000Z',
        minutes: 30,
        expected: '2026-10-17T12:30:00.000Z',
      },
      {
        name: 'adds several hours',
        input: '2026-10-17T12:00:00.000Z',
        minutes: 180,
        expected: '2026-10-17T15:00:00.000Z',
      },
      {
        name: 'crosses midnight into the next day',
        input: '2026-10-17T23:30:00.000Z',
        minutes: 90,
        expected: '2026-10-18T01:00:00.000Z',
      },
      {
        name: 'returns the same instant for zero minutes',
        input: '2026-10-17T12:00:00.000Z',
        minutes: 0,
        expected: '2026-10-17T12:00:00.000Z',
      },
      {
        name: 'accepts ISO strings without milliseconds',
        input: '2026-10-17T12:00:00Z',
        minutes: 120,
        expected: '2026-10-17T14:00:00.000Z',
      },
    ];

    cases.forEach(({ name, input, minutes, expected }) => {
      it(name, () => {
        expect(addMinutesIso(input, minutes)).toBe(expected);
      });
    });
  });

  describe('minutesBetween', () => {
    it('returns the length of a 90-minute slot', () => {
      expect(minutesBetween('2026-10-17T12:00:00Z', '2026-10-17T13:30:00Z')).toBe(90);
    });

    it('counts across midnight', () => {
      expect(minutesBetween('2026-10-17T23:00:00Z', '2026-10-18T01:00:00Z')).toBe(120);
    });

    it('returns zero for the same instant', () => {
      expect(minutesBetween('2026-10-17T12:00:00Z', '2026-10-17T12:00:00Z')).toBe(0);
    });
  });

  describe('findClosestDuration', () => {
    const durations = [90, 120, 150, 180];
    const cases: { name: string; minutes: number; expected: number }[] = [
      { name: 'returns the exact match', minutes: 120, expected: 120 },
      { name: 'rounds down to the nearest option', minutes: 130, expected: 120 },
      { name: 'rounds up to the nearest option', minutes: 145, expected: 150 },
      { name: 'picks the shorter option on a tie', minutes: 135, expected: 120 },
      { name: 'clamps below the shortest option', minutes: 30, expected: 90 },
      { name: 'clamps above the longest option', minutes: 600, expected: 180 },
      { name: 'handles zero minutes', minutes: 0, expected: 90 },
    ];

    cases.forEach(({ name, minutes, expected }) => {
      it(name, () => {
        expect(findClosestDuration(minutes, durations)).toBe(expected);
      });
    });

    it('returns the only option when there is one', () => {
      expect(findClosestDuration(500, [60])).toBe(60);
    });
  });
});
