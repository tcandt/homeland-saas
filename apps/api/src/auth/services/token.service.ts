import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get('auth.jwtExpiresIn') || '15m',
    });
  }

  generateRefreshToken(payload: JwtPayload): string {
    // For refresh tokens, we can use JWT with a longer expiration
    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get('auth.jwtRefreshExpiresIn') || '7d',
    });
  }

  generateOpaqueToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  generatePasswordResetToken(): string {
    return this.generateOpaqueToken(32);
  }

  generateEmailVerificationToken(): string {
    return this.generateOpaqueToken(32);
  }

  verifyAccessToken(token: string): any {
    return this.jwtService.verify(token);
  }

  verifyRefreshToken(token: string): any {
    return this.jwtService.verify(token);
  }
}
