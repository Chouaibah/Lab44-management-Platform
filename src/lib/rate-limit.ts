import { RateLimiterMemory } from "rate-limiter-flexible";

const authLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
  blockDuration: 120,
});

const apiLimiter = new RateLimiterMemory({
  points: 60,
  duration: 60,
  blockDuration: 30,
});

/**
 * Account creation. Deliberately more generous than the login limiter: a whole
 * class can legitimately register from a single NAT'd IP in one sitting, so a
 * 5/minute bucket would lock out real users. This still stops bulk abuse.
 */
const registrationLimiter = new RateLimiterMemory({
  points: 50,
  duration: 600,
  blockDuration: 120,
});

export async function checkAuthRateLimit(key: string): Promise<void> {
  try {
    await authLimiter.consume(key);
  } catch {
    throw new Error("Too many login attempts. Please try again later.");
  }
}

export async function checkRegistrationRateLimit(key: string): Promise<void> {
  try {
    await registrationLimiter.consume(key);
  } catch {
    throw new Error("Too many registration attempts. Please try again later.");
  }
}

export async function checkApiRateLimit(key: string): Promise<void> {
  try {
    await apiLimiter.consume(key);
  } catch {
    throw new Error("Rate limit exceeded. Please slow down.");
  }
}
