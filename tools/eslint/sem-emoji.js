// Regra local: o projeto proíbe emoji em código, comentários, mensagens e templates.
// A verificação percorre o texto-fonte inteiro para cobrir comentários, que não
// aparecem como nós da AST.
const EMOJI = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\u{FE0F}/gu;

/** @type {import('eslint').Rule.RuleModule} */
export const semEmoji = {
  meta: {
    type: 'problem',
    docs: { description: 'Proíbe emoji em qualquer ponto do arquivo.' },
    schema: [],
    messages: {
      emojiEncontrado:
        'Emoji não é permitido. Use ícone vetorial, cor e rótulo textual para comunicar significado.',
    },
  },
  create(context) {
    return {
      Program() {
        const { sourceCode } = context;
        for (const match of sourceCode.text.matchAll(EMOJI)) {
          context.report({
            loc: sourceCode.getLocFromIndex(match.index),
            messageId: 'emojiEncontrado',
          });
        }
      },
    };
  },
};

export default {
  meta: { name: 'eslint-plugin-local' },
  rules: { 'sem-emoji': semEmoji },
};
