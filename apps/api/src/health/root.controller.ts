import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';

@ApiExcludeController()
@Controller()
export class RootController {
  @Public()
  @SkipThrottle()
  @Get()
  index(@Res() res: Response) {
    res.redirect('/docs');
  }
}
