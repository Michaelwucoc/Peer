// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ButtonRow } from "./page-blocks";
import { Markdown } from "./markdown";

afterEach(cleanup);

it("presents stored CMS buttons as short links without modifying source records", () => {
  const block = {
    id: "legacy",
    type: "BUTTONS" as const,
    align: "center" as const,
    buttons: [
      {
        label: { en: "Apply" },
        href: "/signup?callbackUrl=%2Fstudent#form",
        style: "primary" as const,
      },
    ],
  };
  render(<ButtonRow block={block} locale="en" />);
  expect(screen.getByRole("link", { name: "Apply" }).getAttribute("href")).toBe(
    "/tutee?callbackUrl=%2Fstudent#form",
  );
  expect(block.buttons[0]!.href).toBe("/signup?callbackUrl=%2Fstudent#form");
});

it("normalizes Markdown destinations while retaining private and external links", () => {
  render(
    <Markdown>
      {
        "[Join](/viewer-signup?source=cms#identity) [Admin](/crew/admin) [External](https://example.test/signup)"
      }
    </Markdown>,
  );
  expect(screen.getByRole("link", { name: "Join" }).getAttribute("href")).toBe(
    "/viewer?source=cms#identity",
  );
  expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe(
    "/crew/admin",
  );
  expect(
    screen.getByRole("link", { name: "External" }).getAttribute("href"),
  ).toBe("https://example.test/signup");
});

it("drops a button stored with a scheme a raw anchor would execute", () => {
  const block = {
    id: "legacy",
    type: "BUTTONS" as const,
    buttons: [
      {
        label: { en: "Apply" },
        href: "javascript:fetch('/api/session-identity')",
        style: "primary" as const,
      },
      {
        label: { en: "Learn more" },
        href: "https://example.test/signup",
        style: "secondary" as const,
      },
    ],
  };
  render(<ButtonRow block={block} locale="en" />);
  expect(screen.queryByRole("link", { name: "Apply" })).toBeNull();
  expect(screen.getByRole("link", { name: "Learn more" }).getAttribute("href")).toBe(
    "https://example.test/signup",
  );
});
