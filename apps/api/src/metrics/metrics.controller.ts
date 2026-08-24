import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Public } from '../shared/decorators/public.decorator';
import { InternalTokenGuard } from '../shared/guards/internal-token.guard';

@Controller('metrics')
export class MetricsController extends PrometheusController {
  @Public()
  @UseGuards(InternalTokenGuard)
  @Get()
  async index(@Res() response: any) {
    return super.index(response);
  }
}
