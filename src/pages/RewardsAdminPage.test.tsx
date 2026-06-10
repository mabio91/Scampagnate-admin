import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RewardsAdminPage from "./RewardsAdminPage";

const mockSupabaseData = vi.hoisted(() => ({
  rewards: [
    {
      id: "reward-points",
      user_id: "user-1",
      type: "points",
      title: "+50 punti",
      value: null,
      status: "active",
      expiry_date: null,
      redeemed_at: null,
      created_at: "2026-06-01T10:00:00.000Z",
      mission_id: null,
      source_mission_reward_id: null,
    },
    {
      id: "reward-physical",
      user_id: "user-2",
      type: "physical",
      title: "Borraccia trekking",
      value: null,
      status: "pending",
      expiry_date: null,
      redeemed_at: null,
      created_at: "2026-06-02T10:00:00.000Z",
      mission_id: null,
      source_mission_reward_id: null,
    },
    {
      id: "reward-coupon",
      user_id: "user-3",
      type: "coupon",
      title: "SPRITZ10",
      value: null,
      status: "used",
      expiry_date: null,
      redeemed_at: "2026-06-03T10:00:00.000Z",
      created_at: "2026-06-03T09:00:00.000Z",
      mission_id: null,
      source_mission_reward_id: null,
    },
  ],
  profiles: [
    { id: "user-1", first_name: "Alice", last_name: "Punti", email: "alice@example.com" },
    { id: "user-2", first_name: "Mario", last_name: "Fisico", email: "mario@example.com" },
    { id: "user-3", first_name: "Carla", last_name: "Coupon", email: "carla@example.com" },
  ],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "user_rewards") {
        return {
          select: () => ({
            order: async () => ({ data: mockSupabaseData.rewards, error: null }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: async () => ({ data: mockSupabaseData.profiles, error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  configurable: true,
  value: () => false,
});

Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  configurable: true,
  value: () => {},
});

Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  configurable: true,
  value: () => {},
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => {},
});

const renderRewardsPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RewardsAdminPage />
    </QueryClientProvider>,
  );
};

describe("RewardsAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters active rewards by fixed reward type", async () => {
    renderRewardsPage();

    expect(await screen.findByText("+50 punti")).toBeInTheDocument();
    expect(screen.getByText("Borraccia trekking")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Attive (2)" })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("combobox", { name: "Tipologia ricompensa" }), {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
    fireEvent.click(await screen.findByRole("option", { name: "Ricompense fisiche" }));

    await waitFor(() => {
      expect(screen.getByText("Borraccia trekking")).toBeInTheDocument();
      expect(screen.queryByText("+50 punti")).not.toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Attive (1)" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Storico (0)" })).toBeInTheDocument();
    });
  });
});
