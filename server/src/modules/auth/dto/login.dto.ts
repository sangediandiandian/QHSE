import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'qhse' })
  @IsString()
  @MinLength(1)
  username!: string;

  @ApiProperty({ example: 'ant.design' })
  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  autoLogin?: boolean;
}
