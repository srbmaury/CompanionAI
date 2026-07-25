import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/axios", () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
    },
}));

import api from "../api/axios";
import { useResumes } from "../hooks/useResumes";

describe("useResumes", () => {
    beforeEach(() => vi.clearAllMocks());

    it("getResumes returns array from API", async () => {
        api.get.mockResolvedValue({ data: [{ _id: "1", fileName: "resume.pdf" }] });
        const { getResumes } = useResumes();
        const result = await getResumes();
        expect(result).toHaveLength(1);
        expect(result[0]._id).toBe("1");
    });

    it("getResumes returns empty array on non-array response", async () => {
        api.get.mockResolvedValue({ data: null });
        const { getResumes } = useResumes();
        const result = await getResumes();
        expect(result).toEqual([]);
    });

    it("uploadResume sends multipart form and returns data", async () => {
        const mockResume = { _id: "2", fileName: "cv.pdf" };
        api.post.mockResolvedValue({ data: mockResume });
        const { uploadResume } = useResumes();
        const result = await uploadResume(new File(["content"], "cv.pdf"));
        expect(api.post).toHaveBeenCalledWith("/resumes", expect.any(FormData), expect.any(Object));
        expect(result).toEqual(mockResume);
    });

    it("deleteResume calls DELETE with id", async () => {
        api.delete.mockResolvedValue({});
        const { deleteResume } = useResumes();
        await deleteResume("abc123");
        expect(api.delete).toHaveBeenCalledWith("/resumes/abc123");
    });

    it("getResumes passes query params for sort/tag/q", async () => {
        api.get.mockResolvedValue({ data: [] });
        const { getResumes } = useResumes();
        await getResumes({ sort: "date", tag: "tech", q: "engineer" });
        expect(api.get).toHaveBeenCalledWith("/resumes?sort=date&tag=tech&q=engineer");
    });
});
