const STAFF_OTP_API_BASE_URL = 'https://whatsapp.indianstrendstore.in';

const parseErrorMessage = (payload: any, fallback: string): string => {
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
  return fallback;
};

const postJson = async <T>(path: string, body: Record<string, unknown>, fallbackError: string): Promise<T> => {
  const response = await fetch(`${STAFF_OTP_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (response.status === 429) {
    throw new Error('Too many attempts. Please wait and try again.');
  }
  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, fallbackError));
  }
  return payload as T;
};

export const sendStaffOtp = async (email: string): Promise<{ ok?: boolean; message?: string }> => (
  postJson('/api/staff-otp/send', { email }, 'Unable to send verification code.')
);

export const verifyStaffOtp = async (email: string, otp: string): Promise<{ ok: boolean }> => (
  postJson('/api/staff-otp/verify', { email, otp }, 'Invalid or expired OTP.')
);
