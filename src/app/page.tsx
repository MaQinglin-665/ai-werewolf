import { GameClient } from "@/components/GameClient";
import { HomeAnalyticsTracker } from "@/components/HomeAnalyticsTracker";

export default function Home() {
  return (
    <>
      <HomeAnalyticsTracker />
      <GameClient />
    </>
  );
}
