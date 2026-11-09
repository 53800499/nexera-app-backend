import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTenantByAdminDto {
  @IsString()
  @IsNotEmpty({ message: "Le nom de l'entreprise est obligatoire" })
  name: string;

  @IsString()
  @IsOptional()
  type?: 'company' | 'cabinet';

  @IsEmail({}, { message: "L'e-mail administrateur est invalide" })
  @IsNotEmpty({ message: "L'e-mail de l'administrateur est obligatoire" })
  adminEmail: string;

  @IsString()
  @IsNotEmpty({ message: "Le prénom de l'administrateur est requis" })
  adminFirstName: string;

  @IsString()
  @IsNotEmpty({ message: "Le nom de l'administrateur est requis" })
  adminLastName: string;

  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit comporter au moins 6 caractères' })
  adminPassword: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxUsers?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  storageLimitGb?: number;

  @IsArray()
  @IsOptional()
  activeModules?: string[];
}

export class UpdateTenantQuotasDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  maxUsers?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  storageLimitGb?: number;

  @IsArray()
  @IsOptional()
  activeModules?: string[];
}

export class ToggleSuperAdminDto {
  @IsBoolean()
  isSuperAdmin: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateBroadcastDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre du message est requis' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Le contenu du message est requis' })
  message: string;

  @IsString()
  @IsOptional()
  level?: 'INFO' | 'WARNING' | 'CRITICAL';

  @IsString()
  @IsOptional()
  actionLabel?: string;

  @IsString()
  @IsOptional()
  actionUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateMaintenanceDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @IsOptional()
  message?: string;
}

export class SuspendTenantDto {
  @IsString()
  @IsNotEmpty({ message: 'Le motif de suspension est obligatoire pour la traçabilité' })
  reason: string;
}

export class ActivateTenantDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateAssistanceSessionDto {
  @IsString()
  @IsNotEmpty({ message: 'L’identifiant du tenant est requis' })
  tenantId: string;

  @IsString()
  @IsNotEmpty({ message: 'La référence du ticket de support est obligatoire (ex: TICK-1024)' })
  ticketRef: string;

  @IsString()
  @IsNotEmpty({ message: 'La justification de l’intervention technique est obligatoire' })
  justification: string;

  @IsInt()
  @Min(5, { message: 'La durée minimale est de 5 minutes' })
  @Max(120, { message: 'La durée maximale d’une session est de 120 minutes' })
  @IsOptional()
  durationMinutes?: number;
}

export class RevokeAssistanceSessionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ToggleUserStatusDto {
  @IsBoolean()
  isActive: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsString()
  @IsNotEmpty()
  impactedService: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class UpdateIncidentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsString()
  @IsOptional()
  status?: 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';

  @IsString()
  @IsOptional()
  description?: string;
}

export class ResetUserPasswordDto {
  @IsOptional()
  @IsString()
  method?: 'EMAIL' | 'LINK' | 'MANUAL';

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit comporter au moins 8 caractères' })
  newPassword?: string;
}


