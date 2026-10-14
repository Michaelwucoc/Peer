import { describe, expect, it } from "vitest";

import { isSafeButtonHref, layoutSchema } from "./page-blocks";

/** A minimal valid layout carrying one BUTTONS block, so the href rule is what decides. */
const layoutWithHref = (href: string) => [
  {
    id: "actions",
    type: "BUTTONS" as const,
    buttons: [{ label: { en: "Apply" }, href, style: "primary" as const }],
  },
];

describe("landing button destinations", () => {
  it("keeps in-app paths, fragments and absolute web or mail links", () => {
    for (const href of [
      "/tutee",
      "/signup?callbackUrl=%2Fstudent#form",
      "#top",
      "https://example.test/signup",
      "http://example.test",
      "mailto:tutoring@example.test",
    ]) {
      expect(isSafeButtonHref(href)).toBe(true);
      expect(layoutSchema.safeParse(layoutWithHref(href)).success).toBe(true);
    }
  });

  it("rejects a scheme that a raw anchor would execute", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaSCript:alert(document.cookie)",
      " data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ]) {
      expect(isSafeButtonHref(href)).toBe(false);
      expect(layoutSchema.safeParse(layoutWithHref(href)).success).toBe(false);
    }
  });

  it("accepts a blank destination so a half-filled editor row stays saveable", () => {
    expect(isSafeButtonHref("")).toBe(false);
    expect(isSafeButtonHref("   ")).toBe(false);
    expect(layoutSchema.safeParse(layoutWithHref("")).success).toBe(true);
  });

  it("still stores the value unchanged while checking it", () => {
    const parsed = layoutSchema.parse(layoutWithHref("/signup?callbackUrl=%2Fstudent#form"));
    expect(parsed[0]).toMatchObject({
      buttons: [{ href: "/signup?callbackUrl=%2Fstudent#form" }],
    });
  });
});
