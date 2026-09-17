"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Activity,
  Boxes,
  CircleCheck,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { useEmbedders, type Embedder } from "@/hooks/useEmbedders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type SortKey =
  | "embed"
  | "embedder"
  | "sandbox"
  | "load_count"
  | "load_today"
  | "last_seen"
  | "status";

type SortDir = "asc" | "desc";

const columns: { key: SortKey; label: string }[] = [
  { key: "embed", label: "Embed" },
  { key: "embedder", label: "Embedder" },
  { key: "sandbox", label: "Sandbox" },
  { key: "load_today", label: "Today / Total" },
  { key: "last_seen", label: "Last seen" },
  { key: "status", label: "Status" },
];

const NEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function isRecentlyAdded(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < NEW_THRESHOLD_MS;
}

export default function EmbeddersTable() {
  const { data, isLoading, isError } = useEmbedders();

  const [sortKey, setSortKey] = useState<SortKey>("load_today");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const rows = data?.embedders ?? [];

    return [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      let cmp = 0;

      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const total = data?.embedders.length ?? 0;

  const active =
    data?.embedders.filter((e) => e.status === "Active").length ?? 0;

  const inactive = total - active;

  const sandboxed = data?.embedders.filter((e) => e.sandbox).length ?? 0;

  const totalLoads =
    data?.embedders.reduce((sum, e) => sum + e.load_count, 0) ?? 0;

  const totalLoadsToday =
    data?.embedders.reduce((sum, e) => sum + e.load_today, 0) ?? 0;

  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
  const sandboxPct = total > 0 ? Math.round((sandboxed / total) * 100) : 0;

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (isLoading) {
    return <div className="p-6 text-base text-muted-foreground">Loading…</div>;
  }

  if (isError) {
    return (
      <div className="p-6 text-base text-red-600">
        Failed to load embedders.
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8 ">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-primary/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Loads today
            </p>
            <Activity className="size-5 text-primary" />
          </div>

          <p className="mt-4 text-5xl font-bold">
            {totalLoadsToday.toLocaleString()}
          </p>

          <p className="mt-2 text-sm text-muted-foreground">
            {totalLoads.toLocaleString()} total loads
          </p>
        </div>

        <div className="rounded-2xl border bg-muted/30 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Total embedders
            </p>
            <Boxes className="size-5 text-muted-foreground" />
          </div>

          <p className="mt-4 text-5xl font-bold">{total.toLocaleString()}</p>

          <p className="mt-2 text-sm text-muted-foreground">
            {inactive} inactive
          </p>
        </div>

        <div className="rounded-2xl border bg-green-500/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Active</p>
            <CircleCheck className="size-5 text-green-500" />
          </div>

          <p className="mt-4 text-5xl font-bold text-green-500">{active}</p>

          <p className="mt-2 text-sm text-muted-foreground">
            {activePct}% of embedders
          </p>
        </div>

        <div className="rounded-2xl border bg-amber-500/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Sandboxed
            </p>
            <ShieldAlert className="size-5 text-amber-500" />
          </div>

          <p className="mt-4 text-5xl font-bold text-amber-500">{sandboxed}</p>

          <p className="mt-2 text-sm text-muted-foreground">
            {sandboxPct}% of embedders
          </p>
        </div>
      </div>
      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Embedders</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Websites using your player
              </p>
            </div>

            <Badge variant="secondary" className="px-3 py-1 text-sm">
              {total} total
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-14 px-5 text-sm font-semibold">
                  #
                </TableHead>

                {columns.map((col) => (
                  <TableHead key={col.key} className="text-sm font-semibold">
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                    >
                      {col.label}

                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="size-4" />
                        ) : (
                          <ArrowDown className="size-4" />
                        )
                      ) : (
                        <ArrowUpDown className="size-4 opacity-30" />
                      )}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {sorted.map((e: Embedder, i) => (
                <TableRow
                  key={e.id}
                  className="text-base transition-colors hover:bg-muted/30"
                >
                  <TableCell className="px-5 text-sm font-medium text-muted-foreground">
                    {i + 1}
                  </TableCell>

                  <TableCell className="font-medium">{e.embed}</TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {e.embedder.includes("https://") ? (
                        <Link
                          href={e.embedder}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-blue-500 hover:underline"
                        >
                          {e.embedder}
                          <ExternalLink className="size-4" />
                        </Link>
                      ) : e.embedder.includes("http://") ? (
                        <Link
                          href={e.embedder}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-red-500 hover:underline"
                        >
                          {e.embedder}
                          <ExternalLink className="size-4" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {e.embedder}
                        </span>
                      )}

                      {isRecentlyAdded(e.created_at) && (
                        <Badge variant="outline" className="text-xs">
                          New
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    {e.sandbox ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 text-amber-600"
                      >
                        Yes
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-green-500/30 bg-green-500/10 text-green-600"
                      >
                        No
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-semibold">
                        {e.load_today.toLocaleString()}
                      </span>

                      <span className="text-sm text-muted-foreground">
                        / {e.load_count.toLocaleString()}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {new Date(e.last_seen).toLocaleString()}
                  </TableCell>

                  <TableCell>
                    {e.status === "Active" ? (
                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10">
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-muted-foreground"
                      >
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
