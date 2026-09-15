import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateDraftSerialsDto {
  @ApiProperty({ description: 'ID de la ligne de mouvement' })
  @IsString()
  lineId: string;

  @ApiProperty({
    description: 'Nouveaux numéros de série pour cette ligne',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  serialNumbers: string[];
}
