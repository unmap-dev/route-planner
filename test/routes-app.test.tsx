// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// No key in the test build: the app must explain how to get one instead of calling anything.
vi.mock("@/lib/kit/config", async (orig) => ({ ...(await orig<typeof import("@/lib/kit/config")>()), API_KEY: "" }));

import { RoutesApp } from "../components/routes/routes-app";

beforeAll(() => {
  // jsdom has no matchMedia; the simulation reads prefers-reduced-motion through it.
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

const names = () => [...document.querySelectorAll("[data-stop-name]")].map((e) => e.textContent);

describe("Routes without a key", () => {
  it("lists the sample round, labels it, and asks for a key instead of a map", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<RoutesApp />);
    expect(screen.getByText("This demo needs an Unmap API key")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Stops" });
    // The depot, seven stops, the depot again.
    expect(within(list).getAllByRole("listitem").filter((li) => li.parentElement === list).length).toBe(9);
    expect(screen.getAllByText("Sample data").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Optimize order" }).hasAttribute("disabled")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("reorders with buttons, keeps focus on the stop, and calls the order the dispatcher's", () => {
    render(<RoutesApp />);
    const before = names();
    const up = screen.getByRole("button", { name: `Move ${before[1]} earlier` });
    up.focus();
    fireEvent.click(up);
    expect(names().slice(0, 2)).toEqual([before[1], before[0]]);
    expect(document.querySelector('[data-order-source="manual"]')?.textContent).toBe("Your order");
    // At the top, "earlier" is disabled, so focus moves to the stop's other arrow.
    expect(document.activeElement?.getAttribute("aria-label")).toBe(`Move ${before[1]} later`);

    fireEvent.click(screen.getByRole("button", { name: `Remove ${before[2]}` }));
    expect(names()).not.toContain(before[2]);
  });

  it("switches to French", () => {
    render(<RoutesApp />);
    fireEvent.click(screen.getByRole("button", { name: "Français" }));
    expect(screen.getByRole("list", { name: "Arrêts" })).toBeTruthy();
    expect(screen.getByText("Cette démo a besoin d'une clé d'API Unmap")).toBeTruthy();
    expect(window.location.search).toBe("?lang=fr");
  });
});
