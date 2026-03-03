const GLOBAL_PIN_SALT = 'restaurant-os-pin-v1';

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const isValidPinFormat = (pin: string) => /^\d{4,6}$/.test(pin);

export const generatePinSalt = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

export const hashPin = async (pin: string, employeeSalt: string) => {
  const payload = `${GLOBAL_PIN_SALT}:${employeeSalt}:${pin}`;
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(payload));

  return toHex(digest);
};

export const createPinCredentials = async (pin: string) => {
  const salt = generatePinSalt();
  const hash = await hashPin(pin, salt);

  return {
    salt,
    hash,
  };
};
