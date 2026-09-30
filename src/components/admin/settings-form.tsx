"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { SettingsGroup } from "@/lib/settings/definitions";

export type FieldSpec =
  | { key: string; label: string; type: "text" | "number" | "time" | "email" | "url"; help?: string; step?: string; min?: number; max?: number }
  | { key: string; label: string; type: "textarea"; help?: string; rows?: number }
  | { key: string; label: string; type: "boolean"; help?: string }
  | { key: string; label: string; type: "weekdays"; help?: string }
  | { key: string; label: string; type: "features"; help?: string };

type Feature = { title: string; description: string; icon: string };
type Values = Record<string, unknown>;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SettingsForm({ group, fields, initial, title, description }: { group: SettingsGroup; fields: FieldSpec[]; initial: Values; title: string; description?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setValues((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    setErrors({});
    try {
      const payload: Values = {};
      for (const f of fields) {
        const v = values[f.key];
        payload[f.key] = f.type === "number" ? (v === "" || v === null || v === undefined ? 0 : Number(v)) : v;
      }
      await apiFetch(`/api/admin/settings/${group}`, { method: "PUT", json: payload });
      toast.success(`${title} saved`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      toast.error(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card shadow-soft">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `${group}-${f.key}`;
          const err = errors[f.key];
          const wide = f.type === "textarea" || f.type === "features" || f.type === "weekdays";
          return (
            <div key={f.key} className={`grid gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
              {f.type === "boolean" ? (
                <label className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                  <span>
                    <span className="block text-sm font-medium">{f.label}</span>
                    {f.help && <span className="block text-xs text-muted-foreground">{f.help}</span>}
                  </span>
                  <Switch checked={Boolean(values[f.key])} onCheckedChange={(v) => set(f.key, v)} aria-label={f.label} />
                </label>
              ) : (
                <>
                  <Label htmlFor={id}>{f.label}</Label>
                  {f.type === "textarea" ? (
                    <Textarea id={id} rows={f.rows ?? 4} value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} aria-invalid={!!err} />
                  ) : f.type === "weekdays" ? (
                    <div className="flex flex-wrap gap-2" role="group" aria-label={f.label}>
                      {WEEKDAYS.map((d, i) => {
                        const arr = (values[f.key] as number[]) ?? [];
                        const on = arr.includes(i);
                        return (
                          <button key={d} type="button" aria-pressed={on} onClick={() => set(f.key, on ? arr.filter((x) => x !== i) : [...arr, i].sort())} className={`rounded-full border px-3 py-1 text-sm ${on ? "border-brand bg-brand text-white" : "hover:bg-muted"}`}>{d}</button>
                        );
                      })}
                    </div>
                  ) : f.type === "features" ? (
                    <FeaturesEditor value={(values[f.key] as Feature[]) ?? []} onChange={(v) => set(f.key, v)} />
                  ) : (
                    <Input
                      id={id}
                      type={f.type === "number" ? "number" : f.type}
                      step={f.type === "number" ? f.step ?? "1" : undefined}
                      min={f.type === "number" ? f.min : undefined}
                      max={f.type === "number" ? f.max : undefined}
                      value={values[f.key] === null || values[f.key] === undefined ? "" : String(values[f.key])}
                      onChange={(e) => set(f.key, e.target.value)}
                      aria-invalid={!!err}
                      className="h-10"
                    />
                  )}
                  {f.help && !err && <p className="text-xs text-muted-foreground">{f.help}</p>}
                </>
              )}
              {err && <p className="text-xs text-destructive">{err}</p>}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end border-t px-5 py-4">
        <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />} Save {title.toLowerCase()}</Button>
      </div>
    </section>
  );
}

function FeaturesEditor({ value, onChange }: { value: Feature[]; onChange: (v: Feature[]) => void }) {
  const update = (i: number, patch: Partial<Feature>) => onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-3">
      {value.map((f, i) => (
        <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_2fr_120px_auto]">
          <Input value={f.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Title" aria-label={`Feature ${i + 1} title`} className="h-10" />
          <Input value={f.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="Description" aria-label={`Feature ${i + 1} description`} className="h-10" />
          <Input value={f.icon} onChange={(e) => update(i, { icon: e.target.value })} placeholder="lucide icon" aria-label={`Feature ${i + 1} icon`} className="h-10 font-mono text-xs" />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove feature" onClick={() => onChange(value.filter((_, idx) => idx !== i))}><Trash2 aria-hidden /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { title: "", description: "", icon: "sparkles" }])}><Plus aria-hidden /> Add item</Button>
      <p className="text-xs text-muted-foreground">Icon names come from lucide.dev (e.g. wifi, car, map-pin, heart-handshake).</p>
    </div>
  );
}
