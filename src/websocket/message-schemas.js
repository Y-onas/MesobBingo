const { z } = require('zod');

// ─── Client → Server Messages ───────────────────────────────────────

const JoinGameSchema = z.object({
  roomId: z.number().int().positive(),
});

const SelectBoardSchema = z.object({
  gameId: z.number().int().positive(),
  boardNumber: z.number().int().min(1).max(200),
});

const ClaimBingoSchema = z.object({
  gameId: z.number().int().positive(),
});

const LeaveGameSchema = z.object({
  gameId: z.number().int().positive(),
});

// ─── Validation Helper ──────────────────────────────────────────────

/**
 * Validate data against a Zod schema
 * @param {z.ZodSchema} schema
 * @param {any} data
 * @returns {{ success: boolean, data?: any, error?: string }}
 */
const validateMessage = (schema, data) => {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '),
    };
  } catch (err) {
    return { success: false, error: 'Invalid message format' };
  }
};

module.exports = {
  JoinGameSchema,
  SelectBoardSchema,
  ClaimBingoSchema,
  LeaveGameSchema,
  validateMessage,
};
