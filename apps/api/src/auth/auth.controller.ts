import { Controller, Post, Body, ForbiddenException, Get, Patch, Req, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginSchema, ChangePasswordSchema, RefreshTokenSchema, RegisterSchema, ForgotPasswordSchema, ResetPasswordSchema, CreateTeamMemberSchema, UpdateTeamMemberSchema } from '@homeland/shared';
import { ZodValidationPipe } from 'nestjs-zod';
import { Public } from '../shared/decorators/public.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { AllowPasswordChangeRequired } from '../shared/decorators/allow-password-change-required.decorator';
import { SettingsService } from '../settings/settings.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly settingsService: SettingsService,
  ) {}

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
      const accessControl = await this.settingsService.getPublicAccessControl();
      if (!accessControl.registrationEnabled) {
        throw new ForbiddenException({ code: 'AUTH_REGISTRATION_DISABLED', message: 'Public registration is disabled' });
      }
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
  @AllowPasswordChangeRequired()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Post('defer-password-change')
  @ApiBearerAuth()
  @AllowPasswordChangeRequired()
  @ApiOperation({ summary: 'Defer the required password change for the current login session' })
  deferPasswordChange(@CurrentUser('id') userId: string) {
    return this.authService.deferPasswordChange(userId);
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
  @AllowPasswordChangeRequired()
  @ApiOperation({ summary: 'Get current user profile and permissions' })
  getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Get('team')
  @ApiBearerAuth()
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'List tenant user accounts and roles for settings' })
  listTeam(@CurrentUser('tenantId') tenantId: string) {
    return this.authService.listTeam(tenantId);
  }

  @Post('team')
  @ApiBearerAuth()
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Provision a tenant user with an existing role' })
  createTeamMember(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') actorUserId: string,
    @Body() body: unknown,
  ) {
    const input = CreateTeamMemberSchema.parse(body);
    return this.authService.createTeamMember(tenantId, actorUserId, input);
  }

  @Patch('team/:id')
  @ApiBearerAuth()
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Update a tenant team member' })
  updateTeamMember(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') actorUserId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = UpdateTeamMemberSchema.parse(body);
    return this.authService.updateTeamMember(tenantId, actorUserId, id, input);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser('id') userId: string, @Body() body: { fullName?: string }) {
    return this.authService.updateMe(userId, body);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @AllowPasswordChangeRequired()
  @ApiOperation({ summary: 'Change password' })
  changePassword(@CurrentUser('id') userId: string, @Body() body: any) {
    const input = ChangePasswordSchema.parse(body);
    return this.authService.changePassword(userId, input);
  }
}
