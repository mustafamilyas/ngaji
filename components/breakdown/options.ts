// Kept out of the "use client" picker: a server component importing a constant from a client file gets a reference, not the value.
/** The fixed member dimensions of `?rincian=`; the value is what `parseBreakdown` accepts. */
export const FIXED_BREAKDOWN_OPTIONS = [
  { value: "sex", label: "Jenis kelamin" },
  { value: "age", label: "Kelompok umur" },
  { value: "marital", label: "Status pernikahan" },
  { value: "work", label: "Status pekerjaan" },
] as const;
