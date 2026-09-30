import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AllowAuthenticated } from '../../common/decorators/allow-authenticated.decorator';
import { JwtPayload } from '../../shared/interfaces/jwt-payload.interface';
import { SearchService } from './search.service';
import { GlobalSearchQueryDto, GlobalSearchResponse } from './dto/global-search.dto';

@ApiTags('search')
@ApiBearerAuth('access-token')
@Controller('search')
@UseGuards(JwtAuthGuard)
@AllowAuthenticated()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Recherche globale multi-entités',
    description:
      'Recherche transversale résiliente sur clients, devis, factures, commandes, catalogue et RH.',
  })
  async search(
    @Request() req: { user: JwtPayload },
    @Query() queryDto: GlobalSearchQueryDto,
  ): Promise<GlobalSearchResponse> {
    return this.searchService.globalSearch(req.user.tenantId, queryDto.q);
  }
}
