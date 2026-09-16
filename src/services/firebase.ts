import { SignJWT, importPKCS8 } from "jose";

type FirebaseEnv = {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

async function getFirebaseAccessToken(env: FirebaseEnv): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  
  const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

  const cryptoKey = await importPKCS8(privateKey, "RS256");

  const jwt = await new SignJWT({
    scope: FCM_SCOPE,
  })
    .setProtectedHeader({
      alg: "RS256",
      typ: "JWT",
    })
    .setIssuer(env.FIREBASE_CLIENT_EMAIL)
    .setAudience(GOOGLE_TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(cryptoKey);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const result = await response.json() as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !result.access_token) {
    console.error("Firebase access token error:", result);

    throw new Error(
      result.error_description ||
      result.error ||
      "فشل الحصول على Firebase Access Token"
    );
  }

  return result.access_token;
}

export async function sendFirebasePush(
  env: FirebaseEnv,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>
) {
  const accessToken = await getFirebaseAccessToken(env);

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,

          notification: {
            title,
            body,
          },

          data,
        },
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("Firebase push error:", result);

    throw new Error("فشل إرسال Push Notification");
  }

  console.log("Firebase push sent successfully:", result);

  return result;
}