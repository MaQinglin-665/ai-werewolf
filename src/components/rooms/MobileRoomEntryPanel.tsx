"use client";

import type { FormEvent, ReactNode } from "react";

export type RoomEntryBoardOption = {
  id: string;
  label: string;
};

export function getRoomEntryBoardSeatCount(boardId: string): number {
  const seatCountMatch = /^(\d+)p(?:-|$)/.exec(boardId);
  const seatCount = seatCountMatch ? Number(seatCountMatch[1]) : 12;

  if (!Number.isInteger(seatCount) || seatCount < 1) return 12;
  return Math.min(seatCount, 12);
}

export function MobileRoomEntryPanel({
  boardId,
  boards,
  hostName,
  isRestoringSession,
  onBoardIdChange,
  onCreateRoom,
  onHostNameChange,
  onJoinRoom,
  onPlayerNameChange,
  onPreferredSeatChange,
  onRoomCodeChange,
  pending,
  playerName,
  preferredSeatId,
  roomCode,
}: {
  boardId: string;
  boards: RoomEntryBoardOption[];
  hostName: string;
  isRestoringSession: boolean;
  onBoardIdChange: (boardId: string) => void;
  onCreateRoom: (event: FormEvent<HTMLFormElement>) => void;
  onHostNameChange: (hostName: string) => void;
  onJoinRoom: (event: FormEvent<HTMLFormElement>) => void;
  onPlayerNameChange: (playerName: string) => void;
  onPreferredSeatChange: (seatId: number) => void;
  onRoomCodeChange: (roomCode: string) => void;
  pending: string | null;
  playerName: string;
  preferredSeatId: number;
  roomCode: string;
}) {
  const createSeatCount = getRoomEntryBoardSeatCount(boardId);
  const disabled = pending !== null || isRestoringSession;

  return (
    <div className="mobile-room-entry-stack mt-4 space-y-4">
      <form
        className="mobile-room-entry-card mobile-room-entry-card-create space-y-3 rounded-2xl border border-[#7b5a28]/35 bg-black/20 p-3"
        onSubmit={onCreateRoom}
      >
        <RoomEntryField label="昵称">
          <input
            className="mobile-room-entry-input w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-[#fff7df] outline-none transition focus:border-[#f0cf79]/60"
            maxLength={16}
            onChange={(event) => onHostNameChange(event.target.value)}
            value={hostName}
          />
        </RoomEntryField>
        <RoomEntryField label="板子">
          <select
            className="mobile-room-entry-select w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-[#fff7df] outline-none transition focus:border-[#f0cf79]/60"
            onChange={(event) => onBoardIdChange(event.target.value)}
            value={boardId}
          >
            {boards.map((board) => (
              <option className="bg-[#160f0b]" key={board.id} value={board.id}>
                {board.label}
              </option>
            ))}
          </select>
        </RoomEntryField>
        <RoomEntrySeatPicker maxSeat={createSeatCount} onChange={onPreferredSeatChange} value={preferredSeatId} />
        <button
          className="mobile-room-entry-primary w-full rounded-xl border border-[#f0cf79]/45 bg-[#f0cf79] px-4 py-2.5 text-sm font-black text-[#1c1208] transition hover:bg-[#ffe29a] disabled:opacity-55"
          disabled={disabled}
          type="submit"
        >
          {isRestoringSession ? "恢复中..." : pending === "create" ? "创建中..." : "创建房间"}
        </button>
      </form>

      <form
        className="mobile-room-entry-card mobile-room-entry-card-join space-y-3 rounded-2xl border border-[#7b5a28]/35 bg-black/20 p-3"
        onSubmit={onJoinRoom}
      >
        <RoomEntryField label="房间码">
          <input
            className="mobile-room-entry-input w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm uppercase text-[#fff7df] outline-none transition focus:border-[#f0cf79]/60"
            maxLength={12}
            onChange={(event) => onRoomCodeChange(event.target.value.toUpperCase())}
            value={roomCode}
          />
        </RoomEntryField>
        <RoomEntryField label="昵称">
          <input
            className="mobile-room-entry-input w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-[#fff7df] outline-none transition focus:border-[#f0cf79]/60"
            maxLength={16}
            onChange={(event) => onPlayerNameChange(event.target.value)}
            value={playerName}
          />
        </RoomEntryField>
        <RoomEntrySeatPicker maxSeat={12} onChange={onPreferredSeatChange} value={preferredSeatId} />
        <button
          className="mobile-room-entry-secondary w-full rounded-xl border border-emerald-400/35 bg-emerald-500 px-4 py-2.5 text-sm font-black text-[#04140a] transition hover:bg-emerald-300 disabled:opacity-55"
          disabled={disabled}
          type="submit"
        >
          {isRestoringSession ? "恢复中..." : pending === "join" ? "加入中..." : "加入房间"}
        </button>
      </form>
    </div>
  );
}

function RoomEntrySeatPicker({ maxSeat, onChange, value }: { maxSeat: number; onChange: (seatId: number) => void; value: number }) {
  return (
    <div className="mobile-room-entry-seat-picker">
      <div className="mobile-room-entry-seat-label mb-2 text-xs font-bold text-[#bba98a]">座位</div>
      <div className="mobile-room-entry-seat-rail grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="座位">
        {Array.from({ length: maxSeat }, (_, index) => index + 1).map((seatId) => (
          <button
            aria-pressed={value === seatId}
            className={[
              "mobile-room-entry-seat-chip rounded-lg border px-2 py-1.5 text-xs font-black transition",
              value === seatId
                ? "border-[#f0cf79] bg-[#f0cf79] text-[#1c1208]"
                : "border-white/10 bg-black/25 text-[#d9c9a8] hover:border-[#f0cf79]/45",
            ].join(" ")}
            key={seatId}
            onClick={() => onChange(seatId)}
            type="button"
          >
            {seatId}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoomEntryField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="mobile-room-entry-field block">
      <span className="mobile-room-entry-field-label mb-2 block text-xs font-bold text-[#bba98a]">{label}</span>
      {children}
    </label>
  );
}
