const baseUrl = (process.env.ROOM_SMOKE_BASE_URL ?? "http://127.0.0.1:3003").replace(/\/$/, "");
const decoder = new TextDecoder();
const eventTimeoutMs = readPositiveInt(process.env.ROOM_SSE_SMOKE_EVENT_TIMEOUT_MS, 3000);

try {
  const summary = await runRoomSseSmoke();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function runRoomSseSmoke() {
  const created = await postJson("/api/rooms", {
    boardId: "9p-seer-witch-hunter",
    hostName: "HostSmoke",
    hostSeatId: 1,
  });

  const abort = new AbortController();
  try {
    const streamResponse = await fetch(
      `${baseUrl}/api/rooms/${encodeURIComponent(created.room.code)}/stream?playerId=${encodeURIComponent(created.playerId)}`,
      { signal: abort.signal },
    );
    assert(streamResponse.ok, `SSE stream failed: ${streamResponse.status}`);
    assert(streamResponse.body, "SSE stream response has no body.");
    assert(
      streamResponse.headers.get("Content-Type")?.includes("text/event-stream"),
      "SSE stream did not return text/event-stream.",
    );

    const reader = streamResponse.body.getReader();
    const readState = { text: "" };
    const initial = await readRoomEventUntil(reader, readState, (view) => view.room.players.length === 1);
    assert(initial.view.playerSeatId === 1, "Host initial private view did not resolve to seat 1.");

    const joined = await postJson(`/api/rooms/${created.room.code}/join`, {
      playerName: "GuestSmoke",
      seatId: 2,
    });
    const joinedEvent = await readRoomEventUntil(reader, readState, (view) => view.room.players.length === 2);

    await postJson(`/api/rooms/${created.room.id}/start`, { playerId: created.playerId });
    const startedEvent = await readRoomEventUntil(
      reader,
      readState,
      (view) => view.room.status === "in_game" && view.game?.humanSeatId === 1,
    );

    const guestStarted = await getJson(
      `/api/rooms/${created.room.id}/view?playerId=${encodeURIComponent(joined.playerId)}`,
    );
    assert(guestStarted.room.status === "in_game", "Guest private view did not enter the game.");
    assert(guestStarted.game?.humanSeatId === 2, "Guest private view did not resolve to seat 2.");
    assert(Boolean(guestStarted.game?.myRole), "Guest private view did not include a private role.");

    return {
      ok: true,
      baseUrl,
      roomCode: created.room.code,
      hostSeat: startedEvent.view.game.humanSeatId,
      guestSeat: guestStarted.game.humanSeatId,
      guestRole: guestStarted.game.myRole,
      initialEvents: initial.seen,
      joinEvents: joinedEvent.seen,
      startEvents: startedEvent.seen,
    };
  } finally {
    abort.abort();
  }
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonResponse(response, path);
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return readJsonResponse(response, path);
}

async function readJsonResponse(response, path) {
  const data = await response.json().catch(() => null);
  assert(response.ok, `${path} failed: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function readRoomEventUntil(reader, state, predicate, maxEvents = 8) {
  const seen = [];
  for (let index = 0; index < maxEvents; index += 1) {
    const event = await readNextSseEvent(reader, state);
    if (event.event !== "room") continue;

    const view = JSON.parse(event.data);
    seen.push({
      id: event.id,
      status: view.room.status,
      players: view.room.players.length,
      humanSeatId: view.game?.humanSeatId,
    });
    if (predicate(view)) {
      return { seen, view };
    }
  }

  throw new Error(`Expected room event was not observed: ${JSON.stringify(seen)}`);
}

async function readNextSseEvent(reader, state, timeoutMs = eventTimeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const boundary = state.text.indexOf("\n\n");
    if (boundary !== -1) {
      const raw = state.text.slice(0, boundary);
      state.text = state.text.slice(boundary + 2);
      return parseSseEvent(raw);
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error("Timed out waiting for SSE event.");
    }

    const result = await Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timed out waiting for SSE event.")), remainingMs);
      }),
    ]);
    if (result.done) {
      throw new Error("SSE stream ended before the next event.");
    }
    state.text += decoder.decode(result.value, { stream: true });
  }
}

function parseSseEvent(raw) {
  const event = { data: "" };
  const data = [];
  for (const line of raw.split("\n")) {
    const cleanLine = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (cleanLine.startsWith("id:")) {
      event.id = cleanLine.slice(3).trim();
    } else if (cleanLine.startsWith("event:")) {
      event.event = cleanLine.slice(6).trim();
    } else if (cleanLine.startsWith("data:")) {
      data.push(cleanLine.slice(5).trimStart());
    }
  }
  event.data = data.join("\n");
  return event;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
