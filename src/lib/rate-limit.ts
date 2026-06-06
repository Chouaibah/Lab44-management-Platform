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

export async function checkAuthRateLimit(key: string): Promise<void> {
  try {
    await authLimiter.consume(key);
  } catch {
    throw new Error("Too many login attempts. Please try again later.");
  }
}

export async function checkApiRateLimit(key: string): Promise<void> {
  try {
    await apiLimiter.consume(key);
  } catch {
    throw new Error("Rate limit exceeded. Please slow down.");
  }
}
