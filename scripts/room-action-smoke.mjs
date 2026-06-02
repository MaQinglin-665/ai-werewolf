const baseUrl = readOption("base-url", process.env.ROOM_SMOKE_BASE_URL ?? "http://127.0.0.1:3003").replace(/\/$/, "");
const requestTimeoutMs = Number(readOption("request-timeout-ms", process.env.ROOM_ACTION_SMOKE_REQUEST_TIMEOUT_MS ?? "12000"));
const maxSteps = Number(process.env.ROOM_ACTION_SMOKE_MAX_STEPS ?? 220);
const coverage = readOption("coverage", process.env.ROOM_ACTION_SMOKE_COVERAGE ?? "first");
assert(["first", "vote"].includes(coverage), `Unsupported coverage "${coverage}". Use "first" or "vote".`);

try {
  const summary = await runRoomActionSmoke();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function runRoomActionSmoke() {
  const created = await postJson("/api/rooms", {
    boardId: "9p-seer-witch-hunter",
    hostName: "HostActionSmoke",
    hostSeatId: 1,
  });

  const players = [
    { label: "host", playerId: created.playerId, seatId: 1, name: "HostActionSmoke", isHost: true },
  ];

  for (const seatId of [2, 3]) {
    const joined = await postJson(`/api/rooms/${created.room.code}/join`, {
      playerName: `GuestSmoke${seatId}`,
      seatId,
    });
    players.push({
      label: `guest${seatId}`,
      playerId: joined.playerId,
      seatId,
      name: `GuestSmoke${seatId}`,
      isHost: false,
    });
  }

  const started = await postJson(`/api/rooms/${created.room.id}/start`, { playerId: created.playerId });
  assert(started.room.status === "in_game", "Room did not enter in_game after start.");

  const initialViews = await readAllPlayerViews(created.room.id, players);
  assertPairedViews(initialViews);
  for (const entry of initialViews) {
    assert(entry.view.room.status === "in_game", `${entry.label} private view did not enter the game.`);
    assert(entry.view.game?.humanSeatId === entry.seatId, `${entry.label} private view did not resolve to seat ${entry.seatId}.`);
    assert(Boolean(entry.view.game?.myRole), `${entry.label} private view did not include a private role.`);
    assertVisibleRolesAreOnlySelfOrWolfTeammates(entry.view);
  }

  const steps = [];
  const humanActions = [];
  const coveredActionTypes = new Set();
  let voteResolved = false;
  const humanSeatIds = new Set(players.map((player) => player.seatId));

  for (let step = 0; step < maxSteps; step += 1) {
    const views = await readAllPlayerViews(created.room.id, players);
    assertPairedViews(views);

    const actor = findPlayableActor(views);
    if (actor) {
      const wrongPlayer = views.find((entry) => entry.playerId !== actor.playerId);
      assert(wrongPlayer, "Could not find another player for wrong-player rejection.");
      assert(actor.view.turn?.isSelfActor === true, `Playable ${actor.label} action was not marked as self actor.`);
      for (const other of views.filter((entry) => entry.playerId !== actor.playerId)) {
        assert(readPlayableAction(other.view) === undefined, `${other.label} unexpectedly had a playable action.`);
        assert(!other.view.turn?.canHostContinue, `${other.label} can continue while a human action is pending.`);
      }

      const command = commandFromAction(actor.action, { humanSeatIds });
      const wrongResponse = await postJsonResponse(`/api/rooms/${created.room.id}/commands`, {
        playerId: wrongPlayer.playerId,
        ...command,
      });
      assert(wrongResponse.status === 409, `Wrong player command should be rejected with 409, got ${wrongResponse.status}.`);

      const submitted = await postJson(`/api/rooms/${created.room.id}/commands`, {
        playerId: actor.playerId,
        ...command,
      });
      const afterViews = await readAllPlayerViews(created.room.id, players);
      assertPairedViews(afterViews);
      coveredActionTypes.add(actor.action.type);
      voteResolved = voteResolved || (actor.action.type === "vote" && submitted.game?.phase !== "DAY_VOTE");
      humanActions.push({
        step,
        actor: actor.label,
        seatId: actor.seatId,
        actionType: actor.action.type,
        phaseBeforeAction: actor.view.game.phase,
        phaseAfterAction: submitted.game?.phase,
        wrongPlayerStatus: wrongResponse.status,
      });

      if (isCoverageComplete(coveredActionTypes, voteResolved)) {
        return {
          ok: true,
          baseUrl,
          coverage,
          roomCode: created.room.code,
          players: initialViews.map((entry) => ({
            label: entry.label,
            seatId: entry.seatId,
            role: entry.view.game.myRole,
          })),
          coveredActionTypes: [...coveredActionTypes],
          voteResolved,
          finalPhase: submitted.game?.phase,
          humanActions,
          steps,
        };
      }

      continue;
    }

    const hostEntry = views.find((entry) => entry.isHost);
    assert(hostEntry, "Host player is missing.");
    if (hostEntry.view.turn?.canHostContinue || hostEntry.view.game?.availableActions?.some((action) => action.type === "continue")) {
      const advanced = await postJson(`/api/rooms/${created.room.id}/commands`, {
        playerId: hostEntry.playerId,
        type: "continue",
      });
      steps.push({
        step,
        phase: hostEntry.view.game?.phase,
        turnType: hostEntry.view.turn?.type,
        nextPhase: advanced.game?.phase,
      });
      continue;
    }

    if (hostEntry.view.game?.result) {
      throw new Error(`Game ended before smoke covered speech and vote: ${JSON.stringify(hostEntry.view.game.result)}`);
    }

    steps.push({
      step,
      phase: hostEntry.view.game?.phase,
      turnType: hostEntry.view.turn?.type,
      waitingFor: hostEntry.view.turn?.title,
    });
  }

  throw new Error(
    `Could not complete ${coverage} coverage within ${maxSteps} steps at ${baseUrl}. ` +
      `Human actions: ${JSON.stringify(humanActions)} ` +
      `Recent steps: ${summarizeRecentSteps(steps)} ` +
      `All steps: ${JSON.stringify(steps)}`,
  );
}

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function isCoverageComplete(coveredActionTypes, voteResolved) {
  if (coverage === "first") {
    return coveredActionTypes.size > 0;
  }
  return coveredActionTypes.has("speak") && coveredActionTypes.has("vote") && voteResolved;
}

async function readAllPlayerViews(roomId, players) {
  return Promise.all(
    players.map(async (player) => ({
      ...player,
      view: await getJson(`/api/rooms/${roomId}/view?playerId=${encodeURIComponent(player.playerId)}`),
    })),
  );
}

function findPlayableActor(views) {
  for (const entry of views) {
    const action = readPlayableAction(entry.view);
    if (action) return { ...entry, action };
  }
  return undefined;
}

async function postJson(path, body) {
  const response = await postJsonResponse(path, body);
  assert(response.ok, `${path} failed: ${response.status} ${JSON.stringify(response.data)}`);
  return response.data;
}

async function postJsonResponse(path, body) {
  return withTimedRequest(`POST ${path}`, async (signal) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const data = await response.json().catch(() => null);
    return { data, ok: response.ok, status: response.status };
  });
}

async function getJson(path) {
  return withTimedRequest(`GET ${path}`, async (signal) => {
    const response = await fetch(`${baseUrl}${path}`, { signal });
    const data = await response.json().catch(() => null);
    assert(response.ok, `${path} failed: ${response.status} ${JSON.stringify(data)}`);
    return data;
  });
}

async function withTimedRequest(label, request) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await request(controller.signal);
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    throw new Error(`${label} failed after ${elapsedMs}ms at ${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeRecentSteps(steps) {
  return steps
    .slice(-12)
    .map((step) => `${step.step}:${step.phase ?? "unknown"}->${step.nextPhase ?? step.turnType ?? step.waitingFor ?? "pending"}`)
    .join(" | ");
}

function readPlayableAction(view) {
  return view.game?.availableActions?.find((action) => action.type !== "continue");
}

function commandFromAction(action, context) {
  switch (action.type) {
    case "wolfKill":
    case "seerCheck":
      return { type: action.type, targetSeatId: firstTargetSeatId(action, context) };
    case "vote":
    case "sheriffVote":
      return action.targets?.[0] ? { type: action.type, targetSeatId: firstTargetSeatId(action, context) } : { type: action.type };
    case "guardAction":
    case "wolfBeautyCharm":
    case "hunterShoot":
    case "wolfKingShoot":
    case "knightDuel":
    case "sheriffHandoff":
      return action.targets?.[0] ? { type: action.type, targetSeatId: firstTargetSeatId(action, context) } : { type: action.type };
    case "witchAction":
      if (action.canSave) return { type: "witchAction", mode: "save" };
      if (action.canPoison && action.poisonTargets?.[0]) {
        return { type: "witchAction", mode: "poison", targetSeatId: firstTargetSeatId({ targets: action.poisonTargets }, context) };
      }
      return { type: "witchAction", mode: "skip" };
    case "whiteWolfKingExplode":
      return { type: "whiteWolfKingExplode", targetSeatId: firstTargetSeatId(action, context) };
    case "speak":
      return { type: "speak", message: "Room action smoke: I am speaking from my own seat only." };
    case "lastWords":
      return { type: "lastWords", message: "Room action smoke: final words from the active player." };
    case "sheriffNominate":
      return { type: "sheriffNominate", run: Boolean(action.canRun) };
    case "sheriffSpeech":
      return { type: "sheriffSpeech", message: "Room action smoke: sheriff speech from the active player." };
    case "sheriffWithdraw":
      return { type: "sheriffWithdraw", withdraw: false };
  }

  throw new Error(`Unsupported action type: ${action.type}`);
}

function firstTargetSeatId(action, context) {
  const preferredTarget = action.targets?.find((target) => !context.humanSeatIds.has(target.seatId)) ?? action.targets?.[0];
  const seatId = preferredTarget?.seatId;
  assert(Number.isInteger(seatId), `Action ${action.type ?? "unknown"} did not include a target.`);
  return seatId;
}

function assertPairedViews(views) {
  const [first] = views;
  assert(first, "No room views were loaded.");
  for (const entry of views.slice(1)) {
    assert(first.view.room.id === entry.view.room.id, `${entry.label} view points to a different room.`);
    assert(first.view.room.status === entry.view.room.status, `${entry.label} room status diverged.`);
    assert(first.view.game?.id === entry.view.game?.id, `${entry.label} view points to a different game.`);
    assert(first.view.game?.day === entry.view.game?.day, `${entry.label} game day diverged.`);
    assert(first.view.game?.phase === entry.view.game?.phase, `${entry.label} game phase diverged.`);
    assert(first.view.game?.publicEvents?.length === entry.view.game?.publicEvents?.length, `${entry.label} public event count diverged.`);
  }
}

function assertVisibleRolesAreOnlySelfOrWolfTeammates(view) {
  const selfSeatId = view.game?.humanSeatId;
  const wolfTeammateSeatIds = new Set(view.game?.wolfTeammates?.map((teammate) => teammate.seatId) ?? []);
  for (const seat of view.game?.seats ?? []) {
    if (!seat.role || seat.seatId === selfSeatId) continue;
    assert(wolfTeammateSeatIds.has(seat.seatId), `Seat ${seat.seatId} role leaked outside wolf teammate visibility.`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
