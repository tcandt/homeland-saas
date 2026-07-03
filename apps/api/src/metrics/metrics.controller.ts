import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Public } from '../shared/decorators/public.decorator';

@Controller('metrics')
export class MetricsController extends PrometheusController {
  @Public()
  @Get()
  async index(@Res() response: any) {
    return super.index(response);
  }
}
