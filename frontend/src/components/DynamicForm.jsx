import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * DynamicForm renders inputs from a layanan.form_schema array.
 * Props:
 *  - schema: [{ key, label, type, required, options, help_text, placeholder }]
 *  - values: object  e.g. { nama_ptk: "..." }
 *  - onChange: (next_values) => void
 *  - prefill: object  values that should be readonly / pre-filled
 *  - testIdPrefix: string (defaults to "form-field")
 */
export default function DynamicForm({ schema, values, onChange, prefill = {}, testIdPrefix = "form-field" }) {
  if (!schema?.length) return null;

  const setField = (key, v) => onChange({ ...values, [key]: v });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="dynamic-form">
      {schema.map((f) => {
        const id = `${testIdPrefix}-${f.key}`;
        const isPrefilled = Object.prototype.hasOwnProperty.call(prefill, f.key);
        const val = values?.[f.key] ?? (isPrefilled ? prefill[f.key] : "");
        const isTextarea = f.type === "textarea";
        const colSpan = isTextarea ? "md:col-span-2" : "";

        const label = (
          <Label htmlFor={id} className="text-xs uppercase tracking-wider text-zinc-500">
            {f.label}
            {f.required ? <span className="text-red-500 ml-0.5">*</span> : null}
          </Label>
        );

        let input;
        if (f.type === "select") {
          input = (
            <Select value={val || ""} onValueChange={(v) => setField(f.key, v)}>
              <SelectTrigger id={id} className="h-10 mt-1" data-testid={id}><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                {(f.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          );
        } else if (f.type === "textarea") {
          input = (
            <Textarea
              id={id} rows={3} value={val} required={f.required}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.placeholder} className="mt-1"
              data-testid={id}
            />
          );
        } else {
          input = (
            <Input
              id={id} type={f.type === "tel" ? "tel" : f.type === "email" ? "email" : f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
              value={val} required={f.required}
              readOnly={isPrefilled} disabled={isPrefilled}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={`h-10 mt-1 ${isPrefilled ? "bg-zinc-50 text-zinc-600" : ""}`}
              data-testid={id}
            />
          );
        }
        return (
          <div key={f.key} className={colSpan}>
            {label}
            {input}
            {f.help_text && <div className="text-[11px] text-zinc-500 mt-1">{f.help_text}</div>}
          </div>
        );
      })}
    </div>
  );
}
