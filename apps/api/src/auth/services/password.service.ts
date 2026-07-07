import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 12; // ConfigService would be better, but we hardcode a safe default for now, can be read from config.

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, this.SALT_ROUNDS);
  }

  async verifyRefreshToken(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }

  async hashResetToken(token: string): Promise<string> {
    return bcrypt.hash(token, this.SALT_ROUNDS);
  }

  async verifyResetToken(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }

  passwordStrength(password: string): boolean {
    // >=12 chars, Uppercase, Lowercase, Digit, Special character
    const minLength = 12;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    return password.length >= minLength && hasUpper && hasLower && hasDigit && hasSpecial;
  }
}
