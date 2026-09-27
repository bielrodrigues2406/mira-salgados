import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, type Repository } from 'typeorm';

import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { NotFoundError } from '../common/errors/domain.errors.js';
import { Paginated } from '../common/pagination/pagination.js';
import { escaparLike } from '../common/utils/like.js';
import { Cliente } from './cliente.entity.js';
import type { AtualizarClienteDto } from './dto/atualizar-cliente.dto.js';
import type { CriarClienteDto } from './dto/criar-cliente.dto.js';
import type { FiltroClientesDto } from './dto/filtro-clientes.dto.js';

// Só dígitos, espaços e pontuação de telefone: o termo também é procurado no
// telefone. "Escola 2" não vira busca por telefones que contenham 2.
const PARECE_TELEFONE = /^[\d\s()+.-]+$/;

const CAMPOS_EDITAVEIS = ['nome', 'telefone', 'endereco', 'ativo'] as const;

@Injectable()
export class ClientesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Cliente)
    private readonly clientes: Repository<Cliente>,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: FiltroClientesDto): Promise<Paginated<Cliente>> {
    const consulta = this.clientes
      .createQueryBuilder('cliente')
      .orderBy('cliente.nome', 'ASC')
      .addOrderBy('cliente.id', 'ASC')
      .skip(filtro.skip)
      .take(filtro.pageSize);

    if (filtro.ativo !== undefined) {
      consulta.andWhere('cliente.ativo = :ativo', { ativo: filtro.ativo });
    }

    const termo = filtro.busca;
    if (termo) {
      const digitos = PARECE_TELEFONE.test(termo) ? termo.replace(/\D/g, '') : '';
      consulta.andWhere(
        new Brackets((grupo) => {
          // Mesma expressão do índice ix_clientes_nome_busca, para que ele seja usado.
          grupo.where(
            "lower(immutable_unaccent(cliente.nome)) LIKE lower(immutable_unaccent(:nome)) ESCAPE '\\'",
            { nome: `%${escaparLike(termo)}%` },
          );
          if (digitos) {
            grupo.orWhere('cliente.telefone LIKE :telefone', { telefone: `%${digitos}%` });
          }
        }),
      );
    }

    const [itens, total] = await consulta.getManyAndCount();
    return Paginated.of(itens, total, filtro);
  }

  async buscar(id: string): Promise<Cliente> {
    const cliente = await this.clientes.findOneBy({ id });
    if (!cliente) throw new NotFoundError('Cliente');
    return cliente;
  }

  criar(dados: CriarClienteDto, autorId: string): Promise<Cliente> {
    return this.dataSource.transaction(async (manager) => {
      const repositorio = manager.getRepository(Cliente);
      const cliente = await repositorio.save(
        repositorio.create({
          nome: dados.nome,
          telefone: dados.telefone ?? null,
          endereco: dados.endereco ?? null,
        }),
      );
      await this.auditoria.registrar(manager, {
        entidade: 'cliente',
        entidadeId: cliente.id,
        acao: 'CRIACAO',
        antes: null,
        depois: cliente,
        usuarioId: autorId,
      });
      return cliente;
    });
  }

  atualizar(id: string, dados: AtualizarClienteDto, autorId: string): Promise<Cliente> {
    return this.dataSource.transaction(async (manager) => {
      const repositorio = manager.getRepository(Cliente);
      const cliente = await repositorio.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cliente) throw new NotFoundError('Cliente');

      const antes = Object.assign(new Cliente(), cliente);
      if (dados.nome !== undefined) cliente.nome = dados.nome;
      if (dados.telefone !== undefined) cliente.telefone = dados.telefone;
      if (dados.endereco !== undefined) cliente.endereco = dados.endereco;
      if (dados.ativo !== undefined) cliente.ativo = dados.ativo;

      if (CAMPOS_EDITAVEIS.every((campo) => cliente[campo] === antes[campo])) return cliente;

      const salvo = await repositorio.save(cliente);
      await this.auditoria.registrar(manager, {
        entidade: 'cliente',
        entidadeId: id,
        acao: antes.ativo && !salvo.ativo ? 'DESATIVACAO' : 'ATUALIZACAO',
        antes,
        depois: salvo,
        usuarioId: autorId,
      });
      return salvo;
    });
  }
}
