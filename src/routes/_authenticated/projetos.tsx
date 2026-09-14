import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { effectiveStageStatus, formatDate } from "@/lib/status";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/projetos")({
  head: () => ({
    meta: [
      { title: "Projetos de implantação" },
      {
        name: "description",
        content: "Lista de projetos de implantação por cliente, com responsável, datas e progresso.",
      },
      { property: "og:title", content: "Projetos de implantação" },
      {
        property: "og:description",
        content: "Acompanhe o progresso de cada projeto de implantação da carteira.",
      },
    ],
  }),
  component: ProjetosPage,
});

type ProjectForm = {
  id?: string;
  cliente: string;
  descricao: string;
  responsavel: string;
  email_cliente: string;
  data_inicio: string;
  previsao_conclusao: string;
};

const emptyForm: ProjectForm = {
  cliente: "",
  descricao: "",
  responsavel: "",
  email_cliente: "",
  data_inicio: "",
  previsao_conclusao: "",
};

function ProjetosPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<ProjectForm | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stagesQuery = useQuery({
    queryKey: ["all-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_stages")
        .select("project_id, status, data_prevista, data_conclusao");
      if (error) throw error;
      return data;
    },
  });

  const saveProject = useMutation({
    mutationFn: async (values: ProjectForm) => {
      const payload = {
        cliente: values.cliente,
        descricao: values.descricao || null,
        responsavel: values.responsavel || null,
        email_cliente: values.email_cliente || null,
        data_inicio: values.data_inicio || null,
        previsao_conclusao: values.previsao_conclusao || null,
      };
      if (values.id) {
        const { error } = await supabase.from("projects").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projects")
          .insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setForm(null);
      toast.success("Projeto salvo.");
    },
    onError: () => toast.error("Não foi possível salvar o projeto."),
  });

  const toggleArchive = useMutation({
    mutationFn: async ({ id, arquivado }: { id: string; arquivado: boolean }) => {
      const { error } = await supabase.from("projects").update({ arquivado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const projects = (projectsQuery.data ?? []).filter((p) => p.arquivado === showArchived);

  function progressFor(projectId: string) {
    const stages = (stagesQuery.data ?? []).filter((s) => s.project_id === projectId);
    if (stages.length === 0) return { percent: 0, total: 0, done: 0, late: 0 };
    const done = stages.filter((s) => effectiveStageStatus(s) === "concluida").length;
    const late = stages.filter((s) => effectiveStageStatus(s) === "atrasada").length;
    return { percent: Math.round((done / stages.length) * 100), total: stages.length, done, late };
  }

  return (
    <AppShell userLabel={user.email}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground">
            {showArchived ? "Projetos arquivados" : "Implantações em andamento por cliente"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Ver ativos" : "Ver arquivados"}
          </Button>
          <Button size="sm" onClick={() => setForm({ ...emptyForm })}>
            <Plus className="size-4" /> Novo projeto
          </Button>
        </div>
      </div>

      {projectsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {showArchived ? "Nenhum projeto arquivado." : "Nenhum projeto cadastrado ainda."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const p = progressFor(project.id);
            return (
              <div key={project.id} className="rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      to="/projeto/$projectId/cronograma"
                      params={{ projectId: project.id }}
                      className="text-base font-semibold hover:underline"
                    >
                      {project.cliente}
                    </Link>
                    {project.descricao ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{project.descricao}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar projeto"
                      onClick={() =>
                        setForm({
                          id: project.id,
                          cliente: project.cliente,
                          descricao: project.descricao ?? "",
                          responsavel: project.responsavel ?? "",
                          email_cliente: project.email_cliente ?? "",
                          data_inicio: project.data_inicio ?? "",
                          previsao_conclusao: project.previsao_conclusao ?? "",
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={project.arquivado ? "Reativar projeto" : "Arquivar projeto"}
                      onClick={() =>
                        toggleArchive.mutate({ id: project.id, arquivado: !project.arquivado })
                      }
                    >
                      {project.arquivado ? (
                        <ArchiveRestore className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Responsável</dt>
                    <dd className="font-medium">{project.responsavel ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Início</dt>
                    <dd className="font-medium">{formatDate(project.data_inicio)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Previsão</dt>
                    <dd className="font-medium">{formatDate(project.previsao_conclusao)}</dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {p.done} de {p.total} etapas concluídas
                      {p.late > 0 ? ` · ${p.late} atrasada(s)` : ""}
                    </span>
                    <span className="font-medium">{p.percent}%</span>
                  </div>
                  <Progress value={p.percent} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar projeto" : "Novo projeto"}</DialogTitle>
            <DialogDescription>Dados gerais da implantação do cliente.</DialogDescription>
          </DialogHeader>
          {form ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                saveProject.mutate(form);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="cliente">Cliente</Label>
                <Input
                  id="cliente"
                  value={form.cliente}
                  onChange={(e) => setForm({ ...form, cliente: e.target.value })}
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
              <div className="space-y-1.5">
                <Label htmlFor="responsavel">Responsável</Label>
                <Input
                  id="responsavel"
                  value={form.responsavel}
                  onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email_cliente">E-mail do responsável do cliente</Label>
                <Input
                  id="email_cliente"
                  type="email"
                  value={form.email_cliente}
                  onChange={(e) => setForm({ ...form, email_cliente: e.target.value })}
                  placeholder="contato@cliente.com.br"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                  <Label htmlFor="previsao">Previsão de conclusão</Label>
                  <Input
                    id="previsao"
                    type="date"
                    value={form.previsao_conclusao}
                    onChange={(e) => setForm({ ...form, previsao_conclusao: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveProject.isPending}>
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
