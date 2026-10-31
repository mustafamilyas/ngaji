"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Plus } from "lucide-react";
import {
  createTagAction,
  deleteTagAction,
  deleteTagKeyAction,
  recolorTagAction,
  renameTagKeyAction,
  renameTagValueAction,
} from "@/app/dashboard/tag/actions";
import { ColorSwatches } from "@/components/tags/color-swatches";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { touchField } from "@/components/ui/touch";
import { TAG_DEFAULT_COLOR } from "@/lib/constants";
import type { ActionResult } from "@/lib/errors";
import type { GroupTag } from "@/lib/tag/group-tags";

const labelOf = (tag: Pick<GroupTag, "key" | "value">) => (tag.value === null ? tag.key : `${tag.key}:${tag.value}`);

/** Runs one management action; the dialog closes on success and shows the server's message otherwise. */
function useRun(close: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function run(call: () => Promise<ActionResult<unknown>>) {
    setError(null);
    startTransition(async () => {
      const result = await call();
      if (result.ok) close();
      else setError(result.error);
    });
  }
  return { error, pending, run, reset: () => setError(null) };
}

/** Small focused dialog: title, optional text, the fields, the server's message, Batal and the submit button. */
function ManageDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  destructive = false,
  pending,
  error,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  destructive?: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="mt-4 flex flex-col gap-4"
        >
          {children}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: "ghost", size: "lg" })}>Batal</DialogClose>
            <Button type="submit" size="lg" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending ? "Menyimpan…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function usageText(members: number | undefined, activities: number | undefined) {
  if (!members && !activities) return "Belum dipakai oleh anggota atau kegiatan.";
  return `Dipakai oleh ${members ?? 0} anggota dan ${activities ?? 0} kegiatan.`;
}

/**
 * "Tag baru": name (`kunci` or `kunci:nilai`) and color; the tag is created in the manager's own group. Controlled
 * by `open` when a menu opens it (e.g. "Tambah nilai" with the key prefilled), otherwise it brings its own button.
 */
export function NewTagDialog({
  initialName = "",
  triggerLabel = "Tag baru",
  open: openProp,
  onOpenChange,
}: {
  initialName?: string;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<string>(TAG_DEFAULT_COLOR);
  const { error, pending, run, reset } = useRun(() => setOpen(false));

  function setOpen(next: boolean) {
    if (next) {
      setName(initialName);
      setColor(TAG_DEFAULT_COLOR);
      reset();
    }
    setOpenState(next);
    onOpenChange?.(next);
  }

  return (
    <>
      {openProp === undefined && (
        <Button type="button" size="lg" onClick={() => setOpen(true)}>
          <Plus />
          {triggerLabel}
        </Button>
      )}
      <ManageDialog
        open={open}
        onOpenChange={setOpen}
        title="Tag baru"
        description='Tulis "kunci" untuk tag biasa atau "kunci:nilai" untuk tag bernilai, misalnya "prioritas:tinggi".'
        submitLabel="Simpan"
        pending={pending}
        error={error}
        onSubmit={() => run(() => createTagAction({ name, color }))}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="tag-name" className="text-sm font-medium">
            Nama tag
          </label>
          <input id="tag-name" value={name} onChange={(event) => { setName(event.target.value); reset(); }} required autoFocus autoComplete="off" className={touchField} />
        </div>
        <ColorSwatches value={color} onChange={(next) => { setColor(next); reset(); }} />
      </ManageDialog>
    </>
  );
}

type Kind = "color" | "rename" | "delete" | null;

function MenuTrigger({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger aria-label={`Aksi untuk ${label}`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
      <MoreVertical />
    </DropdownMenuTrigger>
  );
}

/** Row menu of one tag: recolor, rename (the value of a key value, or the name of a simple tag), delete. */
export function TagMenu({ tag }: { tag: GroupTag }) {
  const [kind, setKind] = useState<Kind>(null);
  const [color, setColor] = useState(tag.color);
  const [text, setText] = useState("");
  const close = () => setKind(null);
  const { error, pending, run, reset } = useRun(close);
  const label = labelOf(tag);
  const isValue = tag.value !== null;

  function open(next: Exclude<Kind, null>) {
    reset();
    setColor(tag.color);
    setText(isValue ? (tag.value ?? "") : tag.key);
    setKind(next);
  }
  const onOpenChange = (next: boolean) => !next && close();

  return (
    <>
      <DropdownMenu>
        <MenuTrigger label={label} />
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => open("color")}>Ubah warna</DropdownMenuItem>
          <DropdownMenuItem onClick={() => open("rename")}>{isValue ? "Ubah nilai" : "Ubah nama"}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => open("delete")}>Hapus</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ManageDialog open={kind === "color"} onOpenChange={onOpenChange} title="Ubah warna" description={label} submitLabel="Simpan" pending={pending} error={error} onSubmit={() => run(() => recolorTagAction({ tagId: tag.id, color }))}>
        <ColorSwatches value={color} onChange={(next) => { setColor(next); reset(); }} />
      </ManageDialog>

      <ManageDialog
        open={kind === "rename"}
        onOpenChange={onOpenChange}
        title={isValue ? "Ubah nilai" : "Ubah nama"}
        description={label}
        submitLabel="Simpan"
        pending={pending}
        error={error}
        onSubmit={() => run(() => (isValue ? renameTagValueAction({ tagId: tag.id, newValue: text }) : renameTagKeyAction({ tagId: tag.id, newKey: text })))}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="tag-rename" className="text-sm font-medium">
            {isValue ? "Nilai" : "Nama"}
          </label>
          <input id="tag-rename" value={text} onChange={(event) => { setText(event.target.value); reset(); }} required autoFocus autoComplete="off" className={touchField} />
        </div>
      </ManageDialog>

      <ManageDialog
        open={kind === "delete"}
        onOpenChange={onOpenChange}
        title="Hapus tag"
        description={`Hapus "${label}"? ${usageText(tag.members, tag.activities)} Tag disembunyikan dari anggota, kegiatan, pemilih, dan filter.`}
        submitLabel="Hapus tag"
        destructive
        pending={pending}
        error={error}
        onSubmit={() => run(() => deleteTagAction({ tagId: tag.id }))}
      />
    </>
  );
}

/** Menu of a key with values: add a value, rename the key on every value, delete the key with all its values. */
export function KeyMenu({
  keyName,
  firstTagId,
  values,
  members,
  activities,
}: {
  keyName: string;
  /** Any tag of the key; the server renames or deletes the whole key from it. */
  firstTagId: number;
  values: number;
  members: number | undefined;
  activities: number | undefined;
}) {
  const [kind, setKind] = useState<"add" | "rename" | "delete" | null>(null);
  const [text, setText] = useState(keyName);
  const close = () => setKind(null);
  const { error, pending, run, reset } = useRun(close);
  const onOpenChange = (next: boolean) => !next && close();

  function open(next: "add" | "rename" | "delete") {
    reset();
    setText(keyName);
    setKind(next);
  }

  return (
    <>
      <DropdownMenu>
        <MenuTrigger label={`kunci ${keyName}`} />
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => open("add")}>Tambah nilai</DropdownMenuItem>
          <DropdownMenuItem onClick={() => open("rename")}>Ubah nama kunci</DropdownMenuItem>
          <DropdownMenuItem onClick={() => open("delete")}>Hapus kunci</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewTagDialog initialName={`${keyName}:`} open={kind === "add"} onOpenChange={(next) => (next ? setKind("add") : close())} />

      <ManageDialog
        open={kind === "rename"}
        onOpenChange={onOpenChange}
        title="Ubah nama kunci"
        description={`Berlaku untuk semua nilai ${keyName}.`}
        submitLabel="Simpan"
        pending={pending}
        error={error}
        onSubmit={() => run(() => renameTagKeyAction({ tagId: firstTagId, newKey: text }))}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="key-rename" className="text-sm font-medium">
            Nama kunci
          </label>
          <input id="key-rename" value={text} onChange={(event) => { setText(event.target.value); reset(); }} required autoFocus autoComplete="off" className={touchField} />
        </div>
      </ManageDialog>

      <ManageDialog
        open={kind === "delete"}
        onOpenChange={onOpenChange}
        title="Hapus kunci"
        description={`Hapus kunci "${keyName}" beserta ${values} nilainya? ${usageText(members, activities)} Semua nilainya disembunyikan dari anggota, kegiatan, pemilih, dan filter.`}
        submitLabel="Hapus kunci"
        destructive
        pending={pending}
        error={error}
        onSubmit={() => run(() => deleteTagKeyAction({ tagId: firstTagId }))}
      />
    </>
  );
}
