import { IsArray, IsUUID } from 'class-validator';

export class AssignRolesDto {
  @IsUUID('4', { each: true })
  @IsArray()
  roleIds!: string[];
}
