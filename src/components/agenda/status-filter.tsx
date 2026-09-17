"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_META } from "@/lib/agenda";
import type { AppointmentStatus } from "@/lib/types/database.types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_VALUE = "todos";

export function StatusFilter({ value }: { value: AppointmentStatus | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === ALL_VALUE) {
      params.delete("status");
    } else {
      params.set("status", next);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={value ?? ALL_VALUE} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-48">
        <SelectValue placeholder="Todos os status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>Todos os status</SelectItem>
        {APPOINTMENT_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {APPOINTMENT_STATUS_META[status].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
