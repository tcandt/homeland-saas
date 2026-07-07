import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginSchema, ChangePasswordSchema, RefreshTokenSchema, RegisterSchema, ForgotPasswordSchema, ResetPasswordSchema } from '@homeland/shared';
import { ZodValidationPipe } from 'nestjs-zod';
import { Public } from '../shared/decorators/public.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ short: { limit: 500, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login via email or phone' })
  @ApiResponse({ status: 200, description: 'Returns access token and refresh token' })
  login(@Body() body: any, @Req() req: Request) {
    const input = LoginSchema.parse(body);
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(input, ip, userAgent);
  }

  @Public()
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new tenant and user' })
  @ApiResponse({ status: 201, description: 'Returns access token and refresh token' })
  async register(@Body() body: any, @Req() req: Request) {
    try {
      const input = RegisterSchema.parse(body);
      const ip = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];
      return await this.authService.register(input, ip, userAgent);
    } catch (error) {
      console.error('REGISTER ERROR:', error);
      throw error;
    }
  }

  @Public()
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({ status: 200, description: 'Returns success regardless of email existence' })
  forgotPassword(@Body() body: any) {
    const input = ForgotPasswordSchema.parse(body);
    return this.authService.forgotPassword(input);
  }

  @Public()
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiResponse({ status: 200, description: 'Returns success on successful password reset' })
  resetPassword(@Body() body: any) {
    const input = ResetPasswordSchema.parse(body);
    return this.authService.resetPassword(input);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Public()
  @Throttle({ short: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  refresh(@Body() body: any) {
    const input = RefreshTokenSchema.parse(body);
    return this.authService.refresh(input.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile and permissions' })
  getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  changePassword(@CurrentUser('id') userId: string, @Body() body: any) {
    const input = ChangePasswordSchema.parse(body);
    return this.authService.changePassword(userId, input);
  }
}
