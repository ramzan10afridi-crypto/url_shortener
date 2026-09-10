import { Module } from '@nestjs/common';
import { ClicksService } from './clicks.service';

@Module({
  providers: [ClicksService],
  exports: [ClicksService],
})
export class ClicksModule {}
