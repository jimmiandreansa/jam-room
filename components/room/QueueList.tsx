"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import type { QueueItem } from "@/lib/types";

type QueueListProps = {
  items: QueueItem[];
  currentSongId: string | null;
  loading?: boolean;
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
  reorderDisabled?: boolean;
  /** Extra classes on the list `<ul>`. */
  listClassName?: string;
  /** When false, list grows with page (no max-height / no list scrollbar). */
  scrollable?: boolean;
};

function StaticRow({
  item,
  index,
  isNow,
}: {
  item: QueueItem;
  index: number;
  isNow: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-2 py-2 transition ${
        isNow
          ? "bg-jam-accent/15 ring-1 ring-jam-accent/60"
          : "hover:bg-white/5"
      }`}
    >
      <span className="w-6 shrink-0 text-center text-xs text-jam-muted">
        {index + 1}
      </span>
      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-black">
        <Image
          src={item.thumbnail}
          alt=""
          fill
          className="object-cover"
          sizes="64px"
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            isNow ? "text-jam-accent" : "text-white"
          }`}
        >
          {item.title}
        </p>
        {item.added_by_label ? (
          <p
            className="mt-0.5 truncate text-[11px] text-jam-muted"
            title={item.added_by_label}
          >
            <span className="text-white/75">{item.added_by_label}</span>
          </p>
        ) : null}
        {isNow && (
          <p className="text-xs font-medium text-jam-accent/90">Sedang diputar</p>
        )}
      </div>
    </li>
  );
}

function SortableRow({
  item,
  index,
  isNow,
}: {
  item: QueueItem;
  index: number;
  isNow: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl px-2 py-2 transition ${
        isNow
          ? "bg-jam-accent/15 ring-1 ring-jam-accent/60"
          : "hover:bg-white/5"
      } ${isDragging ? "z-10 opacity-90 ring-1 ring-white/30" : ""}`}
    >
      <button
        type="button"
        className="w-8 shrink-0 cursor-grab touch-none text-center text-jam-muted active:cursor-grabbing"
        aria-label="Seret untuk mengubah urutan"
        {...attributes}
        {...listeners}
      >
        ::
      </button>
      <span className="w-6 shrink-0 text-center text-xs text-jam-muted">
        {index + 1}
      </span>
      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-black">
        <Image
          src={item.thumbnail}
          alt=""
          fill
          className="object-cover"
          sizes="64px"
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            isNow ? "text-jam-accent" : "text-white"
          }`}
        >
          {item.title}
        </p>
        {item.added_by_label ? (
          <p
            className="mt-0.5 truncate text-[11px] text-jam-muted"
            title={item.added_by_label}
          >
            <span className="text-white/75">{item.added_by_label}</span>
          </p>
        ) : null}
        {isNow && (
          <p className="text-xs font-medium text-jam-accent/90">Sedang diputar</p>
        )}
      </div>
    </li>
  );
}

export function QueueList({
  items,
  currentSongId,
  loading,
  onReorder,
  reorderDisabled,
  listClassName = "",
  scrollable = true,
}: QueueListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const listScrollClass = scrollable
    ? "max-h-72 overflow-y-auto sm:max-h-96"
    : "overflow-visible";

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-jam-surface/80 p-4 text-sm text-jam-muted">
        Memuat antrean…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-jam-surface/80 p-4 text-sm text-jam-muted">
        Antrean kosong. Cari dan tambahkan lagu.
      </div>
    );
  }

  const ids = items.map((i) => i.id);

  function handleDragEnd(event: DragEndEvent) {
    if (!onReorder || reorderDisabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex).map((i) => i.id);
    void onReorder(next);
  }

  if (!onReorder) {
    return (
      <ul
        className={`space-y-2 rounded-2xl border border-white/10 bg-jam-surface/80 p-2 ${listScrollClass} ${listClassName}`}
      >
        {items.map((item, index) => (
          <StaticRow
            key={item.id}
            item={item}
            index={index}
            isNow={Boolean(
              currentSongId && item.song_id === currentSongId,
            )}
          />
        ))}
      </ul>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul
          className={`space-y-2 rounded-2xl border border-white/10 bg-jam-surface/80 p-2 ${listScrollClass} ${listClassName}`}
        >
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              item={item}
              index={index}
              isNow={Boolean(
                currentSongId && item.song_id === currentSongId,
              )}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
