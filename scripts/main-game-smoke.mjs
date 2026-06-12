import { buildMainGameStreamCommandPath, shouldRetryMainGameSmokeAttempt } from "./main-game-smoke-logic.mjs";

const baseUrl = readOption("base-url", process.env.MAIN_GAME_SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const maxAttempts = readPositiveInt(readOption("attempts", process.env.MAIN_GAME_SMOKE_ATTEMPTS), 8);
const maxSteps = readPositiveInt(readOption("max-steps", process.env.MAIN_GAME_SMOKE_MAX_STEPS), 24);

try {
  const summary = await runMainGameSmoke();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function runMainGameSmoke() {
  const attempts = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const created = await postJson("/api/games", {
      boardId: "6p-beginner-seer",
      humanSeatId: 1,
    });
    assert(created.board?.id === "6p-beginner-seer", "Created game did not use the 6-player beginner board.");
    assert(created.humanSeatId === 1, "Created game did not assign human seat 1.");
    assert(Boolean(created.myRole), "Created game did not include the human private role.");

    const attemptSummary = {
      attempt,
      gameId: created.id,
      role: created.myRole,
      phases: [created.phase],
      submittedHumanNightAction: undefined,
      finalPhase: created.phase,
    };
    attempts.push(attemptSummary);

    let view = created;
    let submittedHumanNightAction = false;
    for (let step = 0; step < maxSteps; step += 1) {
      attemptSummary.finalPhase = view.phase;
      if (view.phase === "DAY_SPEECH") {
        if (submittedHumanNightAction) {
          return {
            ok: true,
            baseUrl,
            boardId: view.board.id,
            gameId: view.id,
            humanSeatId: view.humanSeatId,
            role: view.myRole,
            finalPhase: view.phase,
            submittedHumanNightAction: attemptSummary.submittedHumanNightAction,
            attempts,
          };
        }
        break;
      }

      const humanAction = view.availableActions.find((action) => action.type !== "continue");
      if (humanAction) {
        if (
          shouldRetryMainGameSmokeAttempt({
            phase: view.phase,
            submittedHumanNightAction,
            humanActionType: humanAction.type,
          })
        ) {
          attemptSummary.skippedReason = `First human action appeared outside night: ${view.phase}`;
          break;
        }
        assert(view.phase.startsWith("NIGHT"), `First human action appeared outside night: ${view.phase}`);
        const command = commandFromAction(humanAction, view);
        view = await postJson(`/api/games/${encodeURIComponent(view.id)}/commands`, command);
        submittedHumanNightAction = true;
        attemptSummary.submittedHumanNightAction = {
          step,
          phase: attemptSummary.finalPhase,
          actionType: humanAction.type,
          command,
          nextPhase: view.phase,
        };
        attemptSummary.phases.push(view.phase);
        continue;
      }

      const continueAction = view.availableActions.find((action) => action.type === "continue");
      assert(continueAction, `No playable action or continue action in phase ${view.phase}.`);
      view = await postStreamContinue(view.id);
      attemptSummary.phases.push(view.phase);
    }
  }

  throw new Error(`Could not reach DAY_SPEECH after a human night action. Attempts: ${JSON.stringify(attempts)}`);
}

function commandFromAction(action, view) {
  switch (action.type) {
    case "wolfKill":
    case "seerCheck":
      return { type: action.type, targetSeatId: firstTargetSeatId(action, view) };
    default:
      throw new Error(`Unsupported main-game night action in smoke: ${action.type}`);
  }
}

function firstTargetSeatId(action, view) {
  const target = action.targets?.find((item) => item.seatId !== view.humanSeatId) ?? action.targets?.[0];
  assert(Number.isInteger(target?.seatId), `Action ${action.type} did not include a target.`);
  return target.seatId;
}

async function postStreamContinue(gameId) {
  const streamPath = buildMainGameStreamCommandPath(gameId);
  const response = await fetch(`${baseUrl}${streamPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "continue", aiRuntimeMode: "mock" }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${streamPath} failed: ${response.status} ${text}`);
  }
  assert(response.body, "Stream continue response has no body.");
  assert(
    response.headers.get("Content-Type")?.includes("text/event-stream"),
    "Stream continue did not return text/event-stream.",
  );
  const events = await readSseEvents(response.body);
  const errorEvent = events.find((event) => event.event === "error");
  assert(!errorEvent, `Stream continue returned error: ${errorEvent?.data}`);
  const doneEvent = events.find((event) => event.event === "done");
  assert(doneEvent, `Stream continue did not return a done event: ${JSON.stringify(events)}`);
  const payload = JSON.parse(doneEvent.data);
  assert(payload.view?.id === gameId, "Stream continue returned a different game view.");
  return payload.view;
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  assert(response.ok, `${path} failed: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function readSseEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return text
    .split("\n\n")
    .map((chunk) => {
      const event = chunk.match(/^event:\s*(.+)$/m)?.[1]?.trim();
      const data = chunk.match(/^data:\s*([\s\S]*)$/m)?.[1]?.trim();
      return event && data ? { event, data } : undefined;
    })
    .filter(Boolean);
}

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
