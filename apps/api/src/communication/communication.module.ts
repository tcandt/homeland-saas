import { Module, OnModuleInit } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { SystemUpdateModule } from '../system-update/system-update.module';
import { CommunicationService } from './communication.service';
import { CommunicationScheduler } from './communication.scheduler';
import { CommunicationController } from './communication.controller';
import {
  InAppProvider,
  ConsoleProvider,
  EmailProvider,
  TelegramProvider,
  ZaloProvider,
  SMSProvider,
  PushProvider
} from './providers/communication.providers';
import { ZaloRegistrationService } from './services/zalo-registration.service';
import { AdminZaloAlertsService } from './services/admin-zalo-alerts.service';

@Module({
  imports: [MetricsModule, SystemUpdateModule],
  controllers: [CommunicationController],
  providers: [
    CommunicationService,
    CommunicationScheduler,
    InAppProvider,
    ConsoleProvider,
    EmailProvider,
    TelegramProvider,
    ZaloProvider,
    ZaloRegistrationService,
    AdminZaloAlertsService,
    SMSProvider,
    PushProvider
  ],
  exports: [CommunicationService, ZaloProvider],
})
export class CommunicationModule implements OnModuleInit {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly inApp: InAppProvider,
    private readonly console: ConsoleProvider,
    private readonly email: EmailProvider,
    private readonly telegram: TelegramProvider,
    private readonly zalo: ZaloProvider,
    private readonly sms: SMSProvider,
    private readonly push: PushProvider
  ) {}

  onModuleInit() {
    this.communicationService.registerProvider(this.inApp);
    this.communicationService.registerProvider(this.console);
    this.communicationService.registerProvider(this.email);
    this.communicationService.registerProvider(this.telegram);
    this.communicationService.registerProvider(this.zalo);
    this.communicationService.registerProvider(this.sms);
    this.communicationService.registerProvider(this.push);
  }
}
