import { Injectable, Logger } from '@nestjs/common';
import { CommunicationProvider } from '../communication.service';
import { NotificationChannel } from '../../automation/automation.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class InAppProvider implements CommunicationProvider {
  channel = NotificationChannel.IN_APP;
  
  constructor(private eventEmitter: EventEmitter2) {}

  async send(payload: any): Promise<any> {
    // In-app just emits an event which can be picked up by SSE or WebSockets later
    this.eventEmitter.emit('notification.in_app.sent', payload);
    return { success: true, timestamp: new Date() };
  }
}

@Injectable()
export class ConsoleProvider implements CommunicationProvider {
  channel = NotificationChannel.CONSOLE;
  private readonly logger = new Logger(ConsoleProvider.name);

  async send(payload: any): Promise<any> {
    this.logger.log(`\n\n=== 📢 SYSTEM NOTIFICATION ===\nTitle: ${payload.title}\nMessage: ${payload.message}\n==============================\n`);
    return { success: true };
  }
}

// STUBS
@Injectable() export class EmailProvider implements CommunicationProvider {
  channel = NotificationChannel.EMAIL;
  async send(payload: any): Promise<any> { 
    if (payload?.testMode === 'FAIL_PROVIDER') {
      throw new Error('Simulated failure for E2E testing');
    }
    return { success: true, stub: true }; 
  }
}

@Injectable() export class TelegramProvider implements CommunicationProvider {
  channel = NotificationChannel.TELEGRAM;
  async send(payload: any): Promise<any> { return { success: true, stub: true }; }
}

@Injectable() export class ZaloProvider implements CommunicationProvider {
  channel = NotificationChannel.ZALO;
  async send(payload: any): Promise<any> { return { success: true, stub: true }; }
}

@Injectable() export class SMSProvider implements CommunicationProvider {
  channel = NotificationChannel.SMS;
  async send(payload: any): Promise<any> { return { success: true, stub: true }; }
}

@Injectable() export class PushProvider implements CommunicationProvider {
  channel = NotificationChannel.PUSH;
  async send(payload: any): Promise<any> { return { success: true, stub: true }; }
}
