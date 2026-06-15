import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ReminderChannel } from '../enums/reminder-channel.enum';

export class SendManualReminderDto {
  @ApiProperty({
    description: 'Message personnalisé (corps de la relance)',
    example: 'Bonjour, nous vous rappelons que la facture reste impayée...',
  })
  @IsString()
  @MinLength(10)
  message!: string;

  @ApiPropertyOptional({
    enum: ReminderChannel,
    default: ReminderChannel.EMAIL,
  })
  @IsEnum(ReminderChannel)
  @IsOptional()
  channel?: ReminderChannel;

  @ApiPropertyOptional({
    example: 1,
    description: 'Niveau affiché dans l\'historique (1-3), optionnel pour manuel',
  })
  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  level?: number;

  @ApiPropertyOptional({ description: 'Objet email personnalisé' })
  @IsString()
  @IsOptional()
  subject?: string;
}
