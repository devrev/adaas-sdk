import { Logger } from "./logger";

// Private symbol and token
export const INTERNAL_CHANNEL = Symbol('internal-sdk-channel');
export const verificationToken = Array.from(
  crypto.getRandomValues(new Uint8Array(32)),
  (byte, _) => byte.toString(16).padStart(2, '0')
).join('');

export function getInternalLogger(logger: Logger): Logger {
  return (logger as any)[INTERNAL_CHANNEL](verificationToken);
}

// Factory function to create a user-safe logger that can never access verified channel
export function createUserLogger(logger: Logger): Logger {
  // Create a new logger instance that is guaranteed to be unverified
  // This ensures user code can never access the verified channel
  const userLogger = Object.create(Logger.prototype);
  
  // Copy all the necessary properties but ensure isVerifiedChannel is false
  Object.assign(userLogger, logger);
  userLogger.isVerifiedChannel = false;
  
  // Remove the internal channel method to prevent access
  delete userLogger[INTERNAL_CHANNEL];
  
  // Override the internal channel method to throw an error if accessed
  userLogger[INTERNAL_CHANNEL] = () => {
    throw new Error('Unauthorized access to internal channel');
  };
  
  return userLogger;
}

