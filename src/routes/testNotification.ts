import { Hono } from "hono";
import { sendFirebasePush } from "../services/firebase";

type Bindings = {
  DB: D1Database;

  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
};

type Variables = {
  jwtPayload: {
    userId: number;
    user_role: "Client" | "Admin";
  };
};

const testNotificationRouter = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

testNotificationRouter.post("/test-push", async (c) => {
  try {
    const payload = c.get("jwtPayload");

    if (!payload?.userId) {
      return c.json(
        {
          error: "المستخدم غير مصرح له",
        },
        401
      );
    }

    // نجيب FCM Token بتاع المستخدم اللي عامل Login
    const user = await c.env.DB.prepare(
      "SELECT fcm_token FROM users WHERE id = ?1"
    )
      .bind(payload.userId)
      .first<{ fcm_token: string | null }>();

    if (!user) {
      return c.json(
        {
          error: "المستخدم غير موجود",
        },
        404
      );
    }

    if (!user.fcm_token) {
      return c.json(
        {
          error: "المستخدم ليس لديه FCM Token",
        },
        400
      );
    }
console.log("Firebase project:", c.env.FIREBASE_PROJECT_ID);
console.log("Firebase client email type:", typeof c.env.FIREBASE_CLIENT_EMAIL);
console.log("Firebase client email exists:", !!c.env.FIREBASE_CLIENT_EMAIL);
    await sendFirebasePush(
      c.env,
      user.fcm_token,
      "Canzo",
      "دي رسالة Push تجريبية 🔔",
      {
        type: "withdrawal",
        withdraw_id: "7",
      }
    );

    return c.json(
      {
        message: "تم إرسال Push Notification بنجاح",
      },
      200
    );

  } catch (error) {
    console.error("Test push error:", error);

    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء إرسال Push Notification",
      },
      500
    );
  }
});

export default testNotificationRouter;