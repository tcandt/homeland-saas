import { Injectable } from '@nestjs/common';

@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }

  unix(): number {
    return Math.floor(this.now().getTime() / 1000);
  }

  addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }

  addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400000);
  }

  isExpired(date: Date): boolean {
    return this.now().getTime() > date.getTime();
  }
}
