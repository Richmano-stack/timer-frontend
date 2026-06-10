import { JoinErrorCode } from '@/lib/errors/join';

export function fail(
  code: JoinErrorCode,
  message: string
): { success: false; error: { code: string; message: string } } {
  return { success: false, error: { code, message } };
}
