import { Module } from '@nestjs/common';
import { FloorsController } from './floors.controller';
import { FloorsService } from './floors.service';
import { FloorsRepository } from './floors.repository';

@Module({
  controllers: [FloorsController],
  providers: [FloorsService, FloorsRepository],
})
export class FloorsModule {}
