import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../asyncHandler";
import { runCopilotTurn } from "../../modules/ai/copilot/copilotAgent";

export const copilotRouter = Router();

const ChatSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .min(1),
});

copilotRouter.post(
  "/chat",
  asyncHandler(async (req, res) => {
    const input = ChatSchema.parse(req.body);
    const result = await runCopilotTurn(input);
    res.status(200).json(result);
  })
);
