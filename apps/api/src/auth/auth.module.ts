import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { MailProvider, DbSmtpMailProvider } from './services/mail.service';
import { SettingsModule } from '../settings/settings.module';
import { LocalStorageProvider } from '../documents/providers/storage/local-storage.provider';

@Module({
  imports: [
    SettingsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('auth.jwtSecret'),
        signOptions: {
          expiresIn: configService.get('auth.jwtExpiresIn'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    JwtStrategy, 
    TokenService, 
    PasswordService,
    LocalStorageProvider,
    { provide: MailProvider, useClass: DbSmtpMailProvider }
  ],
  exports: [AuthService, TokenService, PasswordService, MailProvider],
})
export class AuthModule {}
