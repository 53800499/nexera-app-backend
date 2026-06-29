import { ApiProperty } from '@nestjs/swagger';

export class CabinetInviteCodeDto {
  @ApiProperty({
    example: 'NEXR-A7K9-M3P2',
    description:
      "Code opaque à transmettre aux entreprises clientes (ne pas partager l'UUID tenant).",
  })
  inviteCode!: string;
}
