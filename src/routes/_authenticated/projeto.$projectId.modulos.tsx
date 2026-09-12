import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { MODULE_STATUS, MODULE_STATUS_KEYS, formatDate } from "@/lib/status";
import type { ModuleStatus } from "@/lib/status";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProject } from "@/lib/useProject";

export const Route = createFileRoute("/_authenticated/projeto/$projectId/modulos")({
  head: () => ({
    meta: [
      { title: "Módulos homologados" },
      {
        name: "description",
        content:
          "Painel com o status de homologação de cada módulo do projeto, responsáveis e datas.",
      },
      { property: "og:title", content: "Módulos homologados" },
      {
        property: "og:description",
        content: "Status de configuração, teste e homologação dos módulos do projeto.",
      },
    ],
  }),
  component: ModulosPage,
});

type ModuleForm = {
  id?: string;
  nome: string;
  area: string;
  responsavel_cliente: string;
  responsavel_hpro: string;
  status: string;
  data_homologacao: string;
  observacoes: string;
};

const emptyModule: ModuleForm = {
  nome: "",
  area: "",
  responsavel_cliente: "",
  responsavel_hpro: "",
  status: "pendente",
  data_homologacao: "",
  observacoes: "",
};

function ModulosPage() {
  const { projectId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const project = useProject(projectId);
  const [form, setForm] = useState<ModuleForm | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState("todos");

  const modulesQuery = useQuery({
    queryKey: ["modules", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .eq("project_id", projectId)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["modules", projectId] });

  const saveModule = useMutation({
    mutationFn: async (values: ModuleForm) => {
      const payload = {
        nome: values.nome,
        area: values.area || null,
        responsavel_cliente: values.responsavel_cliente || null,
        responsavel_hpro: values.responsavel_hpro || null,
        status: values.status,
        data_homologacao: values.data_homologacao || null,
        observacoes: values.observacoes || null,
      };
      if (values.id) {
        const { error } = await supabase.from("modules").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("modules")
          .insert({ ...payload, project_id: projectId, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
      toast.success("Módulo salvo.");
    },
    onError: () => toast.error("Não foi possível salvar o módulo."),
  });

  const deleteModule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const modules = modulesQuery.data ?? [];

  const responsaveis = useMemo(
    () =>
      Array.from(
        new Set(modules.map((m) => m.responsavel_hpro).filter((v): v is string => Boolean(v))),
      ),
    [modules],
  );

  const filtered = modules.filter((m) => {
    if (statusFiltro !== "todos" && m.status !== statusFiltro) return false;
    if (responsavelFiltro !== "todos" && m.responsavel_hpro !== responsavelFiltro) return false;
    if (busca && !m.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const counts = MODULE_STATUS_KEYS.map((key) => ({
    key,
    label: MODULE_STATUS[key].label,
    total: modules.filter((m) => m.status === key).length,
  }));

  return (
    <AppShell userLabel={user.email}>
      <ProjectHeader
        projectId={projectId}
        cliente={project.data?.cliente ?? "Projeto"}
        subtitle={project.data?.descricao}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-5">
        {counts.map((c) => (
          <div key={c.key} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.total}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar módulo…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-56"
        />
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {MODULE_STATUS_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {MODULE_STATUS[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setForm({ ...emptyModule })}>
            <Plus className="size-4" /> Novo módulo
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Módulo</th>
              <th className="px-4 py-3">Área</th>
              <th className="px-4 py-3">Resp. cliente</th>
              <th className="px-4 py-3">Resp. Hpro</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Homologação</th>
              <th className="px-4 py-3">Observações</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum módulo encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const status = MODULE_STATUS[m.status as ModuleStatus] ?? MODULE_STATUS.pendente;
                return (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{m.nome}</td>
                    <td className="px-4 py-3">{m.area ?? "—"}</td>
                    <td className="px-4 py-3">{m.responsavel_cliente ?? "—"}</td>
                    <td className="px-4 py-3">{m.responsavel_hpro ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={status.className} variant="secondary">
                        {status.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{formatDate(m.data_homologacao)}</td>
                    <td className="max-w-64 px-4 py-3 text-muted-foreground">
                      {m.observacoes ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar módulo"
                          onClick={() =>
                            setForm({
                              id: m.id,
                              nome: m.nome,
                              area: m.area ?? "",
                              responsavel_cliente: m.responsavel_cliente ?? "",
                              responsavel_hpro: m.responsavel_hpro ?? "",
                              status: m.status,
                              data_homologacao: m.data_homologacao ?? "",
                              observacoes: m.observacoes ?? "",
                            })
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir módulo"
                          onClick={() => deleteModule.mutate(m.id)}
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
            <DialogTitle>{form?.id ? "Editar módulo" : "Novo módulo"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                saveModule.mutate(form);
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Módulo</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="area">Área</Label>
                  <Input
                    id="area"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rc">Responsável do cliente</Label>
                  <Input
                    id="rc"
                    value={form.responsavel_cliente}
                    onChange={(e) => setForm({ ...form, responsavel_cliente: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rh">Responsável Hpro</Label>
                  <Input
                    id="rh"
                    value={form.responsavel_hpro}
                    onChange={(e) => setForm({ ...form, responsavel_hpro: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                      {MODULE_STATUS_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {MODULE_STATUS[key].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dh">Data de homologação</Label>
                  <Input
                    id="dh"
                    type="date"
                    value={form.data_homologacao}
                    onChange={(e) => setForm({ ...form, data_homologacao: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs">Observações</Label>
                <Textarea
                  id="obs"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveModule.isPending}>
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
