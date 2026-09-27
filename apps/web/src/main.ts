import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((erro: unknown) => {
  // Falha no bootstrap impede qualquer tela; o console é o único canal possível.
  // eslint-disable-next-line no-console
  console.error(erro);
});
