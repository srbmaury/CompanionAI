import { describe, expect, it } from "vitest";
import { buildCandidateEvaluationEvidence } from "../../services/candidateEvaluationEvidence.js";

describe("candidate evaluation evidence", () => {
    it("keeps the authoritative final system-design transcript even when discussion history is truncated", () => {
        const evidence = buildCandidateEvaluationEvidence({
            systemDesign: true,
            diagramContext: "Components: API Gateway -> Orders Service -> PostgreSQL",
            item: {
                answer: "I started with requirements and chose asynchronous order events. My final design keeps idempotency keys at the API boundary.",
                discussionTurns: [
                    { speaker: "candidate", text: "A later transcript fragment only." },
                    { speaker: "interviewer", text: "How do retries avoid duplicate orders?" },
                ],
            },
        });

        expect(evidence).toContain("I started with requirements");
        expect(evidence).toContain("idempotency keys");
        expect(evidence).toContain("How do retries avoid duplicate orders?");
        expect(evidence).toContain("API Gateway -> Orders Service");
    });

    it("falls back to stored discussion turns for legacy system-design attempts with no final transcript", () => {
        const evidence = buildCandidateEvaluationEvidence({
            systemDesign: true,
            item: { discussionTurns: [{ speaker: "candidate", text: "Use a queue to absorb spikes." }] },
        });
        expect(evidence).toContain("Use a queue to absorb spikes.");
    });
});
