import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(here, "../../scripts/seedDemoAccounts.js");
const source = fs.readFileSync(seedPath, "utf8");

describe("demo account seed", () => {
    it("uses only the srbmaury.com demo domain and bypasses mail flows", () => {
        const emails = [...source.matchAll(/\"([a-z0-9]+(?:[.-][a-z0-9]+)*)@srbmaury\.com\"/gi)].map((match) => match[1]);
        expect(emails.length).toBeGreaterThan(10);
        expect(source).not.toMatch(/sendVerification|mailer|Brevo/i);
        expect(source).toMatch(/isVerified:\s*true/);
    });

    it("covers every supported organization role", () => {
        for (const role of ["owner", "admin", "recruiter", "hiring_manager", "reviewer"]) {
            expect(source).toContain(`\"${role}\"`);
        }
    });
});
