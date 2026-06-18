import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterClientDto {
  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() lastName: string;
  @ApiProperty() @IsEmail()                email: string;
  @ApiProperty() @IsString() @IsNotEmpty() nationalId: string;
  @ApiProperty() @IsString() @IsNotEmpty() phoneNumber: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
}
