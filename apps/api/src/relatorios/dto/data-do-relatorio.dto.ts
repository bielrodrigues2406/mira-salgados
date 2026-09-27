import { DataDoCalendario } from '../../common/validation/data.js';

export class DataDoRelatorioDto {
  /** AAAA-MM-DD */
  @DataDoCalendario()
  data: string;
}
