import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { deviceTokenSchema } from "../validation/auth";
import { getLanguage, localized, localizedError, validationMessage } from "../utils/i18n";
type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

type Variables = {
  jwtPayload: {
    userId: number;
    user_role: "Client" | "Admin";
  };
};

const deviceTokenRouter = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

deviceTokenRouter.post(
  "/device-token",
  zValidator("json", deviceTokenSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success:false,
          error: { code:"VALIDATION_ERROR", message:validationMessage(result.error.issues,getLanguage(c)) },
        },
        400
      );
    }
  }),
  async (c) => {
    try {
      // Get the authenticated user's JWT payload
      const payload = c.get("jwtPayload");

      if (!payload?.userId) {
        return c.json(
          {
            success:false,
            error: { code:"UNAUTHORIZED_USER", message:localizedError(c,"UNAUTHORIZED_USER") },
          },
          401
        );
      }

      const { device_token , language } = c.req.valid("json");

      // Make sure the user exists
      const user = await c.env.DB.prepare(
        "SELECT id FROM users WHERE id = ?1"
      )
        .bind(payload.userId)
        .first<{ id: number }>();

      if (!user) {
        return c.json(
          {
            success:false,
            error: { code:"USER_NOT_FOUND", message:localizedError(c,"USER_NOT_FOUND") },
          },
          404
        );
      }

      // Update the FCM token for the authenticated user
      await c.env.DB.prepare(
        "UPDATE users SET fcm_token = ?1, language =?2, updated_at = datetime('now') WHERE id = ?3"
      )
        .bind(device_token,language , payload.userId)
        .run();

      return c.json(
        {
          message: localized(c,"تم تحديث FCM Token بنجاح","FCM Token updated successfully"),
        },
        200
      );
    } catch (error) {
      console.error("Error while updating FCM token:", error);

      return c.json(
       {
          success:false,
          error: { code:"INTERNAL_SERVER_ERROR", message:localizedError(c,"INTERNAL_SERVER_ERROR") },
        },
        500
      );
    }
  }
);

export default deviceTokenRouter;