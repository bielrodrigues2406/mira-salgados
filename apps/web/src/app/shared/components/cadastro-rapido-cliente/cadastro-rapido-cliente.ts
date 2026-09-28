import {
  afterNextRender,
  Component,
  type ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

import type { Cliente } from '../../../core/models/cliente';
import { ClientesService } from '../../../core/services/clientes.service';
import { mensagemDeErro } from '../../../core/services/mensagem-de-erro';
import { idUnico } from '../../utils/id-unico';
import { ErrosDoCampo } from '../erros-do-campo/erros-do-campo';
import { Icone } from '../icone/icone';

const SO_TELEFONE = /^[\d\s()+.-]+$/;

function digitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/**
 * Cadastro de cliente sem sair da tela: nome, celular e endereço, todos
 * menos o nome opcionais. Fica dentro de outro formulário (o do pedido), por
 * isso não é um <form>: Enter e o botão cadastram aqui sem enviar o pedido.
 */
@Component({
  selector: 'ms-cadastro-rapido-cliente',
  imports: [ErrosDoCampo, FormField, Icone],
  templateUrl: './cadastro-rapido-cliente.html',
  styleUrl: './cadastro-rapido-cliente.css',
  host: { '(keydown.enter)': 'aoApertarEnter($event)' },
})
export class CadastroRapidoCliente {
  private readonly clientes = inject(ClientesService);
  private readonly injector = inject(Injector);

  /** O que foi digitado na busca: vira nome ou celular, conforme o formato. */
  readonly termo = input('');
  readonly cadastrado = output<Cliente>();
  readonly cancelar = output();

  protected readonly id = idUnico('cliente-rapido');
  protected readonly erro = signal<string | null>(null);
  private readonly campoNome = viewChild<ElementRef<HTMLInputElement>>('campoNome');

  private readonly valores = linkedSignal(() => {
    const termo = this.termo().trim();
    const telefone = SO_TELEFONE.test(termo) ? termo : '';
    return { nome: telefone ? '' : termo, telefone, endereco: '' };
  });

  protected readonly formulario = form(
    this.valores,
    (campo) => {
      required(campo.nome, { message: 'Informe o nome.' });
      maxLength(campo.nome, 120, { message: 'Use no máximo 120 caracteres.' });
      validate(campo.telefone, ({ value }) => {
        const numero = digitos(value());
        return numero === '' || /^\d{10,11}$/.test(numero)
          ? undefined
          : { kind: 'telefone', message: 'Informe o DDD e o número, com 10 ou 11 dígitos.' };
      });
      maxLength(campo.endereco, 200, { message: 'Use no máximo 200 caracteres.' });
    },
    {
      submission: {
        action: async () => {
          this.erro.set(null);
          const { nome, telefone, endereco } = this.valores();
          try {
            const cliente = await firstValueFrom(
              this.clientes.criar({
                nome: nome.trim(),
                telefone: digitos(telefone) || null,
                endereco: endereco.trim() || null,
              }),
            );
            this.cadastrado.emit(cliente);
          } catch (falha) {
            this.erro.set(mensagemDeErro(falha));
          }
          return undefined;
        },
      },
    },
  );

  constructor() {
    afterNextRender(() => this.campoNome()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async cadastrar(): Promise<void> {
    await submit(this.formulario);
  }

  /** Enter dentro do cadastro cadastra o cliente, em vez de enviar o formulário de fora. */
  protected aoApertarEnter(evento: Event): void {
    evento.preventDefault();
    void this.cadastrar();
  }
}
