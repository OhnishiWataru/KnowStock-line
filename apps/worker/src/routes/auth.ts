import { Hono } from 'hono';
import { getStaffByEmail, createStaffMember, setStaffPassword } from '@line-crm/db';
import type { Env } from '../index.js';

const auth = new Hono<Env>();

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

auth.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json<{ email: string; password: string }>();

    if (!email || !password) {
      return c.json({ success: false, error: 'メールアドレスとパスワードを入力してください' }, 400);
    }

    const staff = await getStaffByEmail(c.env.DB, email);
    if (!staff) {
      return c.json({ success: false, error: 'メールアドレスまたはパスワードが正しくありません' }, 401);
    }

    if (!staff.password_hash) {
      return c.json({ success: false, error: 'パスワードが設定されていません。管理者に連絡してください' }, 401);
    }

    const inputHash = await hashPassword(password);
    if (inputHash !== staff.password_hash) {
      return c.json({ success: false, error: 'メールアドレスまたはパスワードが正しくありません' }, 401);
    }

    return c.json({
      success: true,
      data: {
        apiKey: staff.api_key,
        name: staff.name,
        role: staff.role,
      },
    });
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});

auth.post('/api/auth/setup', async (c) => {
  try {
    const { email, password, name } = await c.req.json<{
      email: string;
      password: string;
      name: string;
    }>();

    if (!email || !password || !name) {
      return c.json({ success: false, error: '全ての項目を入力してください' }, 400);
    }

    const existing = await getStaffByEmail(c.env.DB, email);
    if (existing) {
      return c.json({ success: false, error: 'このメールアドレスは既に登録されています' }, 409);
    }

    const staff = await createStaffMember(c.env.DB, {
      name,
      email,
      role: 'owner',
    });

    const passwordHash = await hashPassword(password);
    await setStaffPassword(c.env.DB, staff.id, passwordHash);

    return c.json({
      success: true,
      data: {
        apiKey: staff.api_key,
        name: staff.name,
        role: staff.role,
      },
    });
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});

export { auth };
