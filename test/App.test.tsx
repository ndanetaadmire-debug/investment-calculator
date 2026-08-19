import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { project } from "../src/engine/projection";
import { formatRands } from "../src/engine/money";
import { DEFAULT_PLAN, planToQuery } from "../src/engine/urlState";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("App", () => {
  it("shows the projection for the default plan", () => {
    render(<App />);
    expect(screen.getByTestId("final")).toHaveTextContent(formatRands(project(DEFAULT_PLAN).finalCents));
    expect(screen.getByRole("img", { name: /Balance grows to/ })).toBeInTheDocument();
  });

  it("recalculates as the user types and keeps the URL in sync", async () => {
    const user = userEvent.setup();
    render(<App />);
    const monthly = screen.getByLabelText("Monthly contribution");
    await user.clear(monthly);
    await user.type(monthly, "5000");
    const expected = project({ ...DEFAULT_PLAN, monthlyCents: 5_000_00 }).finalCents;
    expect(screen.getByTestId("final")).toHaveTextContent(formatRands(expected));
    expect(window.location.search).toContain("monthly=5000");
  });

  it("shows an inline error and keeps the last valid result for bad input", async () => {
    const user = userEvent.setup();
    render(<App />);
    const before = screen.getByTestId("final").textContent;
    const years = screen.getByLabelText("Years");
    await user.clear(years);
    await user.type(years, "0");
    expect(years).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Must be between 1 and 60");
    expect(screen.getByTestId("final").textContent).toBe(before);
  });

  it("loads a shared scenario from the URL", () => {
    const plan = { ...DEFAULT_PLAN, monthlyCents: 7_500_00, years: 30 };
    window.history.replaceState(null, "", `/?${planToQuery(plan)}`);
    render(<App />);
    expect(screen.getByLabelText("Monthly contribution")).toHaveValue("7500");
    expect(screen.getByRole("heading", { name: "After 30 years" })).toBeInTheDocument();
  });

  it("warns when TFSA limits hold contributions back", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", `/?${planToQuery({ ...DEFAULT_PLAN, monthlyCents: 6_000_00 })}`);
    render(<App />);
    await user.click(screen.getByLabelText(/Tax-free savings account/));
    expect(screen.getByTestId("tfsa-notice")).toHaveTextContent(/penalty tax \(40%\)/);
  });

  it("solves for a goal and applies the answer", async () => {
    const user = userEvent.setup();
    render(<App />);
    const goal = screen.getByRole("region", { name: "What do I need to save?" });
    await user.click(within(goal).getByRole("button", { name: "Use this amount" }));
    // After applying, today's-money balance meets the R1 000 000 target.
    const real = Number(screen.getByTestId("real").textContent!.replace(/[^\d]/g, ""));
    expect(real).toBeGreaterThanOrEqual(1_000_000);
  });

  it("has a labelled form control for every input", () => {
    render(<App />);
    for (const input of screen.getAllByRole("textbox")) expect(input).toHaveAccessibleName();
  });
});
