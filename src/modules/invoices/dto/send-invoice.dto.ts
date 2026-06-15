import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendInvoiceDto {
  @IsEmail()
  @IsOptional()
  @ApiPropertyOptional()
  recipientEmail?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  message?: string;
}
