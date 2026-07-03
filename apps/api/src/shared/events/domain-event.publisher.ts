import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEventInterface } from './domain-event.interface';

@Injectable()
export class DomainEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publish(eventName: string, event: DomainEventInterface) {
    this.eventEmitter.emit(eventName, event);
  }
}
