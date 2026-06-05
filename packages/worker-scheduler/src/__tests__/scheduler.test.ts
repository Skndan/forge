// Worker Scheduler — Scheduler Tests
import { describe, expect, test } from 'bun:test';
import {
  parseCronExpression,
  matchesCronField,
  cronMatches,
  type CronParts,
} from '../scheduler';

describe('Cron Expression Parsing', () => {
  test('parseCronExpression parses 5-field expression', () => {
    const result = parseCronExpression('*/5 * * * *');
    expect(result.minute).toBe('*/5');
    expect(result.hour).toBe('*');
    expect(result.dayOfMonth).toBe('*');
    expect(result.month).toBe('*');
    expect(result.dayOfWeek).toBe('*');
  });

  test('parseCronExpression throws for invalid expression', () => {
    expect(() => parseCronExpression('* * *')).toThrow('Invalid cron expression');
    expect(() => parseCronExpression('')).toThrow('Invalid cron expression');
  });

  test('parseCronExpression handles specific values', () => {
    const result = parseCronExpression('30 9 * * 1-5');
    expect(result.minute).toBe('30');
    expect(result.hour).toBe('9');
    expect(result.dayOfWeek).toBe('1-5');
  });
});

describe('matchesCronField', () => {
  test('wildcard matches everything', () => {
    expect(matchesCronField('*', 0)).toBe(true);
    expect(matchesCronField('*', 23)).toBe(true);
    expect(matchesCronField('*', 59)).toBe(true);
  });

  test('exact value matches', () => {
    expect(matchesCronField('5', 5)).toBe(true);
    expect(matchesCronField('0', 0)).toBe(true);
    expect(matchesCronField('59', 59)).toBe(true);
  });

  test('exact value rejects mismatch', () => {
    expect(matchesCronField('5', 6)).toBe(false);
    expect(matchesCronField('30', 0)).toBe(false);
  });

  test('step values match intervals', () => {
    expect(matchesCronField('*/5', 0)).toBe(true);
    expect(matchesCronField('*/5', 5)).toBe(true);
    expect(matchesCronField('*/5', 10)).toBe(true);
    expect(matchesCronField('*/5', 3)).toBe(false);
  });

  test('range values match', () => {
    expect(matchesCronField('1-5', 1)).toBe(true);
    expect(matchesCronField('1-5', 3)).toBe(true);
    expect(matchesCronField('1-5', 5)).toBe(true);
    expect(matchesCronField('1-5', 0)).toBe(false);
    expect(matchesCronField('1-5', 6)).toBe(false);
  });

  test('comma-separated values match', () => {
    expect(matchesCronField('0,15,30,45', 0)).toBe(true);
    expect(matchesCronField('0,15,30,45', 15)).toBe(true);
    expect(matchesCronField('0,15,30,45', 7)).toBe(false);
  });
});

describe('cronMatches', () => {
  test('every minute matches always', () => {
    expect(cronMatches('* * * * *')).toBe(true);
  });

  test('specific minute matches only when valid', () => {
    const now = new Date();
    const minute = now.getMinutes();
    expect(cronMatches(`${minute} * * * *`)).toBe(true);
  });

  test('specific minute rejects wrong minute', () => {
    const now = new Date();
    const wrongMinute = (now.getMinutes() + 30) % 60;
    expect(cronMatches(`${wrongMinute} * * * *`)).toBe(false);
  });

  test('every 5 minutes pattern', () => {
    const now = new Date();
    const minute = now.getMinutes();
    const isMultipleOf5 = minute % 5 === 0;
    expect(cronMatches('*/5 * * * *')).toBe(isMultipleOf5);
  });

  test('specific hour and minute', () => {
    const now = new Date();
    expect(cronMatches(`${now.getMinutes()} ${now.getHours()} * * *`)).toBe(true);
  });

  test('wrong hour does not match', () => {
    const now = new Date();
    const wrongHour = (now.getHours() + 5) % 24;
    expect(cronMatches(`* ${wrongHour} * * *`)).toBe(false);
  });
});
