import {
  afterNextRender,
  Component,
  type ElementRef,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, FormRoot, maxLength, required, validate } from '@angular/forms/signals';

import { ErrosDoCampo } from '../../../shared/components/erros-do-campo/erros-do-campo';
import { Icone } from '../../../shared/components/icone/icone';
import { formatarTelefone } from '../../../shared/pipes/telefone.pipe';
import { idUnico } from '../../../shared/utils/id-unico';

export interface DadosCliente {
  nome: string;
  telefone: string | null;
  endereco: string | null;
  ativo: boolean;
}

export const CLIENTE_VAZIO: DadosCliente = {
  nome: '',
  telefone: null,
  endereco: null,
  ativo: true,
};

/** Grava os dados e devolve a mensagem de erro para exibir, ou null se deu certo. */
export type SalvarCliente = (dados: DadosCliente) => Promise<string | null>;

function digitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Formulário em contexto, usado para cadastrar e para editar no lugar. */
@Component({
  selector: 'ms-cliente-formulario',
  imports: [ErrosDoCampo, FormField, FormRoot, Icone],
  templateUrl: './cliente-formulario.html',
  styleUrl: './cliente-formulario.css',
})
export class ClienteFormulario {
  readonly titulo = input.required<string>();
  readonly inicial = input<DadosCliente>(CLIENTE_VAZIO);
  /** Na edição aparece a opção de desativar. */
  readonly edicao = input(false);
  readonly rotuloSalvar = input('Salvar cliente');
  readonly salvar = input.required<SalvarCliente>();
  readonly cancelar = output();

  protected readonly id = idUnico('cliente');
  protected readonly erro = signal<string | null>(null);
  private readonly campoNome = viewChild.required<ElementRef<HTMLInputElement>>('campoNome');

  private readonly valores = linkedSignal(() => {
    const inicial = this.inicial();
    return {
      nome: inicial.nome,
      telefone: formatarTelefone(inicial.telefone),
      endereco: inicial.endereco ?? '',
      ativo: inicial.ativo,
    };
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
          const { nome, telefone, endereco, ativo } = this.valores();
          const erro = await this.salvar()({
            nome: nome.trim(),
            telefone: digitos(telefone) || null,
            endereco: endereco.trim() || null,
            ativo,
          });
          this.erro.set(erro);
          return undefined;
        },
      },
    },
  );

  constructor() {
    afterNextRender(() => {
      this.campoNome().nativeElement.focus();
    });
  }
}
