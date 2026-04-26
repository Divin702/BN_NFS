import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
} from 'class-validator';
import { Role } from '../../users/enums/role.enum';

export class InviteUserDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'jane.smith@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '1199900054321' })
  @IsString()
  @IsNotEmpty()
  nationalId: string;

  @ApiProperty({ example: '+250788111111' })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid phone number' })
  phoneNumber: string;

  @ApiProperty({ enum: Role, example: Role.LEGAL_CLERK })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ example: 'Ministry of Justice' })
  @IsOptional()
  @IsString()
  organization?: string;
}
