import type { HumanGameView } from "@/game/types";

export type TableEventFeedItem = HumanGameView["publicEvents"][number];

export function buildTableEventFeed(game: HumanGameView | null): TableEventFeedItem[] {
  return game?.publicEvents.filter((event) => event.phase !== "DAY_SPEECH").slice(-18).reverse() ?? [];
}
