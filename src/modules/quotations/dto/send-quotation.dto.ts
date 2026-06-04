import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendQuotationDto {
  @IsEmail()
  @IsOptional()
  recipientEmail?: string;

  @IsString()
  @IsOptional()
  message?: string;
}
