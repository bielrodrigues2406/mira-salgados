import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  // Sem regra de tamanho mínimo no login: a política vale no cadastro. O teto
  // limita o custo de hashing que um corpo de requisição pode provocar.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  senha: string;
}
