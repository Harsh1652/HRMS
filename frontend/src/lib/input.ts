import type { FormEvent } from 'react';

// Runs before react-hook-form's onChange, so the form only ever sees digits.
export function keepDigits(event: FormEvent<HTMLInputElement>): void {
  const input = event.currentTarget;
  input.value = input.value.replace(/\D/g, '');
}

export const PHONE_PATTERN = /^\d{10}$/;
