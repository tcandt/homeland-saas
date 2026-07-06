import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ClockService } from './clock.service';

describe('ClockService', () => {
  let service: ClockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClockService],
    }).compile();

    service = module.get<ClockService>(ClockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return current date via now()', () => {
    const timeBefore = Date.now();
    const now = service.now();
    const timeAfter = Date.now();

    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(timeBefore);
    expect(now.getTime()).toBeLessThanOrEqual(timeAfter);
  });

  it('should return current unix timestamp', () => {
    const unix = service.unix();
    expect(typeof unix).toBe('number');
    expect(unix).toBeCloseTo(Math.floor(Date.now() / 1000), 1);
  });

  it('should correctly add minutes', () => {
    const baseDate = new Date('2024-01-01T12:00:00Z');
    const result = service.addMinutes(baseDate, 15);
    expect(result.toISOString()).toBe('2024-01-01T12:15:00.000Z');
  });

  it('should correctly add days', () => {
    const baseDate = new Date('2024-01-01T12:00:00Z');
    const result = service.addDays(baseDate, 5);
    expect(result.toISOString()).toBe('2024-01-06T12:00:00.000Z');
  });

  it('should evaluate isExpired correctly', () => {
    // Past date
    const past = new Date(Date.now() - 10000);
    expect(service.isExpired(past)).toBe(true);

    // Future date
    const future = new Date(Date.now() + 10000);
    expect(service.isExpired(future)).toBe(false);
  });
});
