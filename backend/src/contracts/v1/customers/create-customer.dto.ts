import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[+0-9()\-\s]+$/, { message: 'phone must contain valid phone characters.' })
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
