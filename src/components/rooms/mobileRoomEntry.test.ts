import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoomClient } from "../RoomClient";

function renderRoomEntry() {
  return renderToStaticMarkup(createElement(RoomClient));
}

describe("RoomClient mobile room entry", () => {
  it("renders compact mobile hooks for create and join without burying the actions", () => {
    const html = renderRoomEntry();

    expect(html).toContain("mobile-room-entry-panel");
    expect(html).toContain("mobile-room-entry-stack");
    expect(html).toContain("mobile-room-entry-card-create");
    expect(html).toContain("mobile-room-entry-card-join");
    expect(html).toContain("mobile-room-entry-seat-rail");
    expect(html).toContain("mobile-room-entry-primary");
    expect(html).toContain("mobile-room-entry-secondary");
    expect(html).toContain("创建房间");
    expect(html).toContain("加入房间");
  });

  it("uses the selected create board capacity instead of showing twelve seats by default", () => {
    const html = renderRoomEntry();
    const createStart = html.indexOf("mobile-room-entry-card-create");
    const joinStart = html.indexOf("mobile-room-entry-card-join");

    expect(createStart).toBeGreaterThan(-1);
    expect(joinStart).toBeGreaterThan(createStart);

    const createCardHtml = html.slice(createStart, joinStart);
    const createSeatChipCount = createCardHtml.match(/mobile-room-entry-seat-chip/g)?.length ?? 0;

    expect(createSeatChipCount).toBe(6);
  });
});
