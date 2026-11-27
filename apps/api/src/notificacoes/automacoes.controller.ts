import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  CurrentUser,
  SomenteAdmin,
  type UsuarioAutenticado,
} from '../common/auth/usuario-autenticado.js';
import type { Paginated } from '../common/pagination/pagination.js';
import {
  AtualizarDestinoDto,
  AtualizarRegraDto,
  CriarDestinoDto,
  FiltroHistoricoNotificacoesDto,
  PausarConexaoDto,
  PreviaRegraDto,
  ReconciliarOutboxDto,
  TestarEnvioRealDto,
} from './dto/automacoes.dto.js';
import type {
  DestinoNotificacaoDto,
  EstadoConexaoDto,
  ItemHistoricoNotificacaoDto,
  PainelAutomacoesResposta,
  PreviaRegraResposta,
  RegraNotificacaoDto,
} from './dto/automacoes-resposta.dto.js';
import { AutomacoesService } from './servicos/automacoes.service.js';

/**
 * Painel de automações e notificações (WhatsApp). Toda operação de configuração,
 * simulação, pausa e reconciliação é restrita a administradores (ADR 0019).
 */
@Controller('automacoes')
@SomenteAdmin()
export class AutomacoesController {
  constructor(private readonly automacoes: AutomacoesService) {}

  @Get()
  obterPainel(): Promise<PainelAutomacoesResposta> {
    return this.automacoes.obterPainel();
  }

  @Post('destinos')
  criarDestino(
    @Body() dados: CriarDestinoDto,
    @CurrentUser() autor: UsuarioAutenticado,
  ): Promise<DestinoNotificacaoDto> {
    return this.automacoes.criarDestino(dados, autor.id);
  }

  @Patch('destinos/:id')
  atualizarDestino(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarDestinoDto,
    @CurrentUser() autor: UsuarioAutenticado,
  ): Promise<DestinoNotificacaoDto> {
    return this.automacoes.atualizarDestino(id, dados, autor.id);
  }

  @Patch('regras/:id')
  atualizarRegra(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarRegraDto,
    @CurrentUser() autor: UsuarioAutenticado,
  ): Promise<RegraNotificacaoDto> {
    return this.automacoes.atualizarRegra(id, dados, autor.id);
  }

  @Post('regras/:id/previa')
  @HttpCode(200)
  gerarPrevia(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: PreviaRegraDto,
  ): Promise<PreviaRegraResposta> {
    return this.automacoes.gerarPrevia(id, dados);
  }

  @Post('regras/:id/simular')
  @HttpCode(200)
  simularRegra(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: PreviaRegraDto,
    @CurrentUser() autor: UsuarioAutenticado,
  ): Promise<ItemHistoricoNotificacaoDto> {
    return this.automacoes.simularRegra(id, dados, autor.id);
  }

  @Post('regras/:id/testar-envio')
  @HttpCode(200)
  testarEnvioReal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: TestarEnvioRealDto,
    @CurrentUser() autor: UsuarioAutenticado,
  ): Promise<ItemHistoricoNotificacaoDto> {
    return this.automacoes.testarEnvioReal(id, dados, autor.id);
  }

  @Post('conexao/pausar')
  @HttpCode(200)
  pausarConexao(
    @Body() dados: PausarConexaoDto,
    @CurrentUser() autor: UsuarioAutenticado,
  ): Promise<EstadoConexaoDto> {
    return this.automacoes.pausarConexao(dados, autor.id);
  }

  @Post('conexao/retomar')
  @HttpCode(200)
  retomarConexao(@CurrentUser() autor: UsuarioAutenticado): Promise<EstadoConexaoDto> {
    return this.automacoes.retomarConexao(autor.id);
  }

  @Get('historico')
  listarHistorico(
    @Query() filtro: FiltroHistoricoNotificacoesDto,
  ): Promise<Paginated<ItemHistoricoNotificacaoDto>> {
    return this.automacoes.listarHistorico(filtro);
  }

  @Post('historico/:id/reconciliar')
  @HttpCode(200)
  reconciliarOutbox(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: ReconciliarOutboxDto,
    @CurrentUser() autor: UsuarioAutenticado,
  ): Promise<ItemHistoricoNotificacaoDto> {
    return this.automacoes.reconciliarOutbox(id, dados, autor.id);
  }

  @Post('historico/:id/copiado')
  @HttpCode(200)
  registrarCopiaManual(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ItemHistoricoNotificacaoDto> {
    return this.automacoes.registrarCopiaManual(id);
  }
}
