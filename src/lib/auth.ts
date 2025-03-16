import bcrypt from 'bcryptjs';

/**
 * 비밀번호를 해시화합니다.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * 비밀번호를 검증합니다.
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * 비밀번호 유효성을 검사합니다.
 * - 최소 8자 이상
 * - 최소 1개의 대문자
 * - 최소 1개의 소문자
 * - 최소 1개의 숫자
 * - 최소 1개의 특수문자
 */
export function validatePassword(password: string): {
  isValid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return {
      isValid: false,
      message: '비밀번호는 최소 8자 이상이어야 합니다.',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: '비밀번호는 최소 1개의 대문자를 포함해야 합니다.',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: '비밀번호는 최소 1개의 소문자를 포함해야 합니다.',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: '비밀번호는 최소 1개의 숫자를 포함해야 합니다.',
    };
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return {
      isValid: false,
      message: '비밀번호는 최소 1개의 특수문자를 포함해야 합니다.',
    };
  }

  return { isValid: true };
}

/**
 * JWT 토큰에서 사용자 정보를 추출합니다.
 */
export function getTokenData(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch {
    return null;
  }
} 