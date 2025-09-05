import { z } from "zod";

export const ObjectIdString = z
    .string()
    .regex(/^[a-f\d]{24}$/i, { message: "Invalid id format" });

export const PaginationQuery = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});