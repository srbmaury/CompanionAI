import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAssessmentRecord, generateQuestionsForRound } = vi.hoisted(() => ({
    createAssessmentRecord: vi.fn(),
    generateQuestionsForRound: vi.fn(),
}));

vi.mock("../../models/Assessment.js", () => ({
    default: {
        create: createAssessmentRecord,
        findOne: vi.fn(),
    },
}));

vi.mock("../../utils/generateQuestions.js", () => ({
    generateQuestionsForRound,
}));

import { createAdaptiveAssessment } from "../../controllers/hiringAdaptiveAssessmentController.js";

const response = () => {
    const res = {
        statusCode: 200,
        body: undefined,
        status: vi.fn((code) => { res.statusCode = code; return res; }),
        json: vi.fn((body) => { res.body = body; return res; }),
    };
    return res;
};

const baseRequest = (round) => ({
    organizationId: "64b000000000000000000001",
    organization: { name: "Acme" },
    user: { _id: "64b000000000000000000002" },
    body: {
        title: "Backend interview",
        jobRole: "Backend Engineer",
        jobDescription: "Build reliable APIs and distributed services in production.",
        rounds: [round],
    },
});

describe("Hire recruiter-only primary questions", () => {
    beforeEach(() => {
        createAssessmentRecord.mockReset();
        generateQuestionsForRound.mockReset();
        createAssessmentRecord.mockImplementation(async (value) => ({ _id: "assessment-1", ...value }));
    });

    it("never silently generates primary questions when adaptive questions are disabled", async () => {
        const req = baseRequest({
            name: "Technical",
            description: "Reliability judgment",
            deliveryMode: "conversational",
            adaptive: false,
            questionCount: 3,
            questions: [{
                text: "Describe a production incident you owned and the trade-off you made.",
                weight: 2,
                competencies: ["Reliability"],
                required: true,
            }],
        });
        const res = response();
        const next = vi.fn();

        await createAdaptiveAssessment(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(generateQuestionsForRound).not.toHaveBeenCalled();
        expect(createAssessmentRecord).toHaveBeenCalledWith(expect.objectContaining({
            rounds: [expect.objectContaining({
                adaptive: false,
                questionCount: 1,
                questions: [expect.objectContaining({
                    text: "Describe a production incident you owned and the trade-off you made.",
                    weight: 2,
                    competencies: ["Reliability"],
                    required: true,
                })],
            })],
        }));
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it("requires at least one reviewed question in recruiter-only mode", async () => {
        const req = baseRequest({
            name: "Technical",
            description: "Reliability judgment",
            deliveryMode: "conversational",
            adaptive: false,
            questionCount: 3,
            questions: [],
        });
        const res = response();
        const next = vi.fn();

        await createAdaptiveAssessment(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body.message).toMatch(/at least one reviewed question/i);
        expect(generateQuestionsForRound).not.toHaveBeenCalled();
        expect(createAssessmentRecord).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });
});
