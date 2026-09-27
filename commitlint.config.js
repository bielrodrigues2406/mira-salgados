export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Assunto curto; o corpo do commit explica o porquê quando necessário.
    'header-max-length': [2, 'always', 72],
  },
};
