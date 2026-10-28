"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { touchField } from "@/components/ui/touch";
import { useKeepValues } from "@/lib/forms/use-keep-values";

import type { ActionResult } from "@/lib/errors";
import type { Organization } from "@/lib/generated/prisma/client";
import { TIMEZONES, TIMEZONE_LABELS } from "@/lib/validation/enums";
import { updateOrganizationAction } from "./actions";

export function OrganizationForm({ name, timezone }: { name: string; timezone: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<Organization> | null, FormData>(
    updateOrganizationAction,
    null,
  );
  const onSubmit = useKeepValues(formAction);

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="organization-name" className="text-sm font-medium">
          Nama organisasi
        </label>
        <input id="organization-name" name="name" defaultValue={name} required maxLength={100} className={touchField} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="organization-timezone" className="text-sm font-medium">
          Zona waktu
        </label>
        <select
          id="organization-timezone"
          name="timezone"
          // React resets the form to its first-mount defaults after the action; keying on the saved zone remounts the select with the new default.
          key={timezone}
          defaultValue={timezone}
          className={touchField}
        >
          {TIMEZONES.map((zone) => (
            <option key={zone} value={zone}>
              {TIMEZONE_LABELS[zone]} ({zone})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Menentukan batas &quot;hari ini&quot; di seluruh aplikasi. Tanggal dan jam kegiatan yang tersimpan tidak berubah.
        </p>
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-muted-foreground">
          Tersimpan.
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
