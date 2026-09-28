import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope } from '../models/api';
import type { Painel } from '../models/painel';

@Injectable({ providedIn: 'root' })
export class PainelService {
  /** A data é o "hoje" do aparelho, que é o da família. */
  doDia(data: () => string): HttpResourceRef<Painel | undefined> {
    return httpResource(() => ({ url: `${environment.apiUrl}/painel`, params: { data: data() } }), {
      parse: (corpo) => (corpo as ApiEnvelope<Painel>).data,
    });
  }
}
