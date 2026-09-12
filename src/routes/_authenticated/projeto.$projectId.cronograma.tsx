import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  STAGE_STATUS,
  STAGE_STATUS_KEYS,
  effectiveStageStatus,
  formatDate,
  todayISO,
} from "@/lib/status";
import { AppShell } from "@/components/AppShell";
import { ProjectHeader } from "@/components/ProjectTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProject } from "@/lib/useProject";

export const Route = createFileRoute("/_authenticated/projeto/$projectId/cronograma")({
  head: () => ({
    meta: [
      { title: "Cronograma do projeto" },
      {
        name: "description",
        content: "Etapas da implantação com responsáveis, datas previstas e status de execução.",
      },
      { property: "og:title", content: "Cronograma do projeto" },
      {
        property: "og:description",
        content: "Acompanhe etapas, prazos e atrasos do projeto de implantação.",
      },
    ],
  }),
  component: CronogramaPage,
});

type StageForm = {
  id?: string;
  nome: string;
  descricao: string;
  responsavel: string;
  data_inicio: string;
  data_prevista: string;
  data_conclusao: string;
  status: string;
};

const emptyStage: StageForm = {
  nome: "",
  descricao: "",
  responsavel: "",
  data_inicio: "",
  data_prevista: "",
  data_conclusao: "",
  status: "nao_iniciada",
};

function CronogramaPage() {
  const { projectId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const project = useProject(projectId);
  const [form, setForm] = useState<StageForm | null>(null);

  const stagesQuery = useQuery({
    queryKey: ["stages", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_stages")
        .select("*")
        .eq("project_id", projectId)
        .order("data_prevista", { ascending: true, nullsFirst: false })
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["stages", projectId] });
    queryClient.invalidateQueries({ queryKey: ["all-stages"] });
  };

  const saveStage = useMutation({
    mutationFn: async (values: StageForm) => {
      const payload = {
        nome: values.nome,
        descricao: values.descricao || null,
        responsavel: values.responsavel || null,
        data_inicio: values.data_inicio || null,
        data_prevista: values.data_prevista || null,
        data_conclusao: values.data_conclusao || null,
        status: values.status,
      };
      if (values.id) {
        const { error } = await supabase.from("project_stages").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_stages")
          .insert({ ...payload, project_id: projectId, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
      toast.success("Etapa salva.");
    },
    onError: () => toast.error("Não foi possível salvar a etapa."),
  });

  const concludeStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_stages")
        .update({ status: "concluida", data_conclusao: todayISO() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const stages = stagesQuery.data ?? [];
  const done = stages.filter((s) => effectiveStageStatus(s) === "concluida").length;
  const late = stages.filter((s) => effectiveStageStatus(s) === "atrasada").length;
  const percent = stages.length ? Math.round((done / stages.length) * 100) : 0;

  return (
    <AppShell userLabel={user.email}>
      <ProjectHeader
        projectId={projectId}
        cliente={project.data?.cliente ?? "Projeto"}
        subtitle={project.data?.descricao}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Etapas" value={String(stages.length)} />
        <SummaryCard label="Concluídas" value={String(done)} />
        <SummaryCard label="Atrasadas" value={String(late)} tone={late > 0 ? "danger" : undefined} />
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Progresso</p>
          <p className="mt-1 text-2xl font-semibold">{percent}%</p>
          <Progress value={percent} className="mt-2" />
        </div>
      </div>

      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setForm({ ...emptyStage })}>
          <Plus className="size-4" /> Nova etapa
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3">Início</th>
              <th className="px-4 py-3">Previsto</th>
              <th className="px-4 py-3">Conclusão</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {stages.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma etapa cadastrada.
                </td>
              </tr>
            ) : (
              stages.map((stage) => {
                const status = effectiveStageStatus(stage);
                return (
                  <tr key={stage.id} className="border-t">
                    <td className="px-4 py-3">
                      <p className="font-medium">{stage.nome}</p>
                      {stage.descricao ? (
                        <p className="text-xs text-muted-foreground">{stage.descricao}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{stage.responsavel ?? "—"}</td>
                    <td className="px-4 py-3">{formatDate(stage.data_inicio)}</td>
                    <td
                      className={
                        status === "atrasada" ? "px-4 py-3 font-medium text-danger" : "px-4 py-3"
                      }
                    >
                      {formatDate(stage.data_prevista)}
                    </td>
                    <td className="px-4 py-3">{formatDate(stage.data_conclusao)}</td>
                    <td className="px-4 py-3">
                      <Badge className={STAGE_STATUS[status].className} variant="secondary">
                        {STAGE_STATUS[status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {status !== "concluida" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Marcar como concluída"
                            onClick={() => concludeStage.mutate(stage.id)}
                          >
                            <Check className="size-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar etapa"
                          onClick={() =>
                            setForm({
                              id: stage.id,
                              nome: stage.nome,
                              descricao: stage.descricao ?? "",
                              responsavel: stage.responsavel ?? "",
                              data_inicio: stage.data_inicio ?? "",
                              data_prevista: stage.data_prevista ?? "",
                              data_conclusao: stage.data_conclusao ?? "",
                              status: stage.status,
                            })
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir etapa"
                          onClick={() => deleteStage.mutate(stage.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar etapa" : "Nova etapa"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                saveStage.mutate(form);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome da etapa</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="responsavel">Responsável</Label>
                  <Input
                    id="responsavel"
                    value={form.responsavel}
                    onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm({ ...form, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_STATUS_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {STAGE_STATUS[key].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inicio">Início</Label>
                  <Input
                    id="inicio"
                    type="date"
                    value={form.data_inicio}
                    onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prevista">Previsto</Label>
                  <Input
                    id="prevista"
                    type="date"
                    value={form.data_prevista}
                    onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conclusao">Conclusão</Label>
                  <Input
                    id="conclusao"
                    type="date"
                    value={form.data_conclusao}
                    onChange={(e) => setForm({ ...form, data_conclusao: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveStage.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === "danger" ? "mt-1 text-2xl font-semibold text-danger" : "mt-1 text-2xl font-semibold"}>
        {value}
      </p>
    </div>
  );
}
