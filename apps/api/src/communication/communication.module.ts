import { Module, OnModuleInit } from '@nestjs/common';
import { CommunicationService } from './communication.service';
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

import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CommunicationController],
  providers: [
    PrismaService,
    CommunicationService,
    InAppProvider,
    ConsoleProvider,
    EmailProvider,
    TelegramProvider,
    ZaloProvider,
    SMSProvider,
    PushProvider
  ],
  exports: [CommunicationService],
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
