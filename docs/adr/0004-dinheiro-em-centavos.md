# ADR 0004 — Valores monetários em centavos inteiros

## Contexto

O acerto diário divide o caixa proporcionalmente entre produtores. Somar valores
em ponto flutuante acumula erro de arredondamento, e a divisão proporcional
precisa fechar exatamente com o caixa. O driver do PostgreSQL devolve `numeric`
como texto justamente para não perder precisão.

## Decisão

- Banco: `numeric(10,2)`.
- Aplicação: inteiros em centavos, com o tipo `Centavos` (número com marca de
  tipo) e as operações de `common/utils/dinheiro.ts`. A conversão entre o texto
  do banco e centavos é feita por `centavosTransformer`, sem `parseFloat`.
- API: campos monetários trafegam como inteiros em centavos, com o sufixo
  `Centavos` no nome (`precoUnitarioCentavos`, `totalCentavos`). O sufixo deixa a
  unidade explícita no contrato e impede que o cliente interprete 9500 como
  R$ 9.500,00.
- Rateio: método do maior resto (`ratearInteiro`). Cada parte recebe o piso da
  sua cota; os centavos que sobram vão para as maiores frações. A soma das
  partes é sempre igual ao total. O mesmo algoritmo calcula percentuais em
  décimos que somam exatamente 100,0%.

## Alternativas consideradas

- **Biblioteca de decimal arbitrário (decimal.js, big.js).** Resolve a precisão,
  mas espalha um tipo de objeto por toda a aplicação e pela serialização. Com
  duas casas decimais fixas, inteiros bastam e são mais simples de testar.
- **Decimais como texto na API (`"95.00"`).** Legível, mas obriga todo cliente a
  fazer parsing monetário, que é exatamente onde o erro aparece.

## Consequências

- Limite prático de 13 dígitos inteiros, bem acima do `numeric(10,2)`.
- Os produtos intermediários do rateio usam BigInt, porque `total * peso` pode
  passar de `Number.MAX_SAFE_INTEGER`.
