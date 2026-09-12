export type StageStatus =
  | "nao_iniciada"
  | "em_andamento"
  | "concluida"
  | "atrasada"
  | "em_risco";

export type ModuleStatus =
  | "pendente"
  | "em_configuracao"
  | "em_teste"
  | "homologado"
  | "bloqueado";

export const STAGE_STATUS: Record<StageStatus, { label: string; className: string }> = {
  nao_iniciada: { label: "Não iniciada", className: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", className: "bg-warning/20 text-warning-foreground" },
  concluida: { label: "Concluída", className: "bg-success/20 text-success" },
  atrasada: { label: "Atrasada", className: "bg-danger/15 text-danger" },
  em_risco: { label: "Em risco", className: "bg-danger/10 text-danger" },
};

export const MODULE_STATUS: Record<ModuleStatus, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  em_configuracao: { label: "Em configuração", className: "bg-info/15 text-info" },
  em_teste: { label: "Em teste", className: "bg-warning/20 text-warning-foreground" },
  homologado: { label: "Homologado", className: "bg-success/20 text-success" },
  bloqueado: { label: "Bloqueado", className: "bg-danger/15 text-danger" },
};

export const STAGE_STATUS_KEYS = Object.keys(STAGE_STATUS) as StageStatus[];
export const MODULE_STATUS_KEYS = Object.keys(MODULE_STATUS) as ModuleStatus[];

/** Uma etapa está atrasada quando passou da data prevista sem conclusão. */
export function effectiveStageStatus(stage: {
  status: string;
  data_prevista: string | null;
  data_conclusao: string | null;
}): StageStatus {
  const status = stage.status as StageStatus;
  if (status === "concluida" || stage.data_conclusao) return "concluida";
  if (stage.data_prevista && stage.data_prevista < todayISO()) return "atrasada";
  return status;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}
