import { Module } from '@nestjs/common';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { BuildingsRepository } from './buildings.repository';

@Module({
  controllers: [BuildingsController],
  providers: [BuildingsService, BuildingsRepository],
})
export class BuildingsModule {}
