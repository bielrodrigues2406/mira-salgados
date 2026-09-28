import {
  afterNextRender,
  Component,
  DestroyRef,
  type ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { ClientesService } from '../../../core/services/clientes.service';
import type { Cliente } from '../../../core/models/cliente';
import { TelefonePipe } from '../../pipes/telefone.pipe';
import { CadastroRapidoCliente } from '../cadastro-rapido-cliente/cadastro-rapido-cliente';
import { Icone } from '../icone/icone';

export interface ClienteEscolhido {
  id: string;
  nome: string;
  telefone: string | null;
  endereco?: string | null;
}

const ESPERA_DA_BUSCA_MS = 250;
const RESULTADOS = 6;

/**
 * Escolha de cliente por busca, ligada ao formulário como um campo comum
 * ([formField]) ou por [(value)]: o valor é o id do cliente escolhido.
 */
@Component({
  selector: 'ms-seletor-cliente',
  imports: [CadastroRapidoCliente, Icone, RouterLink, TelefonePipe],
  templateUrl: './seletor-cliente.html',
  styleUrl: './seletor-cliente.css',
})
export class SeletorCliente implements FormValueControl<string> {
  private readonly clientes = inject(ClientesService);
  private readonly injector = inject(Injector);

  readonly value = model('');
  readonly invalid = input(false);
  readonly touch = output();
  /** Id do campo de busca, para o rótulo do formulário apontar para ele. */
  readonly idCampo = input.required<string>();
  readonly descricao = input<string>();
  /** Cliente já escolhido ao abrir, na edição de um pedido. */
  readonly inicial = input<ClienteEscolhido | null>(null);
  /** Pedidos novos só aceitam cliente ativo; relatórios buscam também os desativados. */
  readonly somenteAtivos = input(true);
  /** No pedido: oferece cadastrar um cliente novo sem sair da tela. */
  readonly permiteCadastro = input(false);
  /** Cliente escolhido ou recém-cadastrado, com o endereço para a entrega. */
  readonly escolheu = output<ClienteEscolhido | null>();

  protected readonly escolhido = linkedSignal(() => this.inicial());
  protected readonly termo = signal('');
  protected readonly cadastrando = signal(false);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected readonly resultados = this.clientes.listar(() => {
    const busca = this.termo();
    return busca
      ? { page: 1, pageSize: RESULTADOS, busca, ativo: this.somenteAtivos() ? true : undefined }
      : undefined;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizador);
    });
  }

  protected aoDigitar(valor: string): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.termo.set(valor.trim());
    }, ESPERA_DA_BUSCA_MS);
  }

  protected escolher(cliente: ClienteEscolhido): void {
    this.escolhido.set(cliente);
    this.value.set(cliente.id);
    this.cadastrando.set(false);
    this.escolheu.emit(cliente);
    this.touch.emit();
  }

  protected aoCadastrar(cliente: Cliente): void {
    this.escolher({
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      endereco: cliente.endereco,
    });
  }

  protected trocar(): void {
    this.escolhido.set(null);
    this.escolheu.emit(null);
    this.value.set('');
    this.termo.set('');
    afterNextRender(() => this.campo()?.nativeElement.focus(), { injector: this.injector });
  }
}
