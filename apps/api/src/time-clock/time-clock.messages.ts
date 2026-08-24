import { TimeEntryType } from '@timekeeper/shared';

export const INVALID_SEQUENCE_MESSAGES: Record<TimeEntryType, string> = {
  ENTRADA: 'Já existe uma jornada em andamento ou finalizada neste dia.',
  SAIDA_ALMOCO: 'Não é possível registrar saída para almoço sem estar em jornada.',
  RETORNO_ALMOCO: 'Não é possível retornar do almoço sem ter registrado a saída para almoço.',
  SAIDA: 'Não é possível registrar uma saída sem uma entrada ativa.',
};
