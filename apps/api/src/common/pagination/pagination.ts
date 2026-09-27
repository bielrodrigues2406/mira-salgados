import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

// Toda coleção potencialmente ilimitada é paginada desde o início: trocar uma
// lista completa por paginação depois quebra o contrato com os clientes.
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize = 20;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}

export class Paginated<T> {
  constructor(
    readonly items: readonly T[],
    readonly total: number,
    readonly page: number,
    readonly pageSize: number,
    /** Totais da coleção inteira, não só da página, como o total em aberto dos fiados. */
    readonly resumo?: object,
  ) {}

  static of<T>(
    items: readonly T[],
    total: number,
    query: PaginationQueryDto,
    resumo?: object,
  ): Paginated<T> {
    return new Paginated(items, total, query.page, query.pageSize, resumo);
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.pageSize);
  }

  map<U>(transform: (item: T) => U): Paginated<U> {
    return new Paginated(
      this.items.map(transform),
      this.total,
      this.page,
      this.pageSize,
      this.resumo,
    );
  }
}
