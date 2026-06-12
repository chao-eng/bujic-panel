import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function GET() {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { configName: 'system_application' },
    });

    let loginCaptcha = false;
    let register = false;

    if (setting) {
      try {
        const val = JSON.parse(setting.configValue);
        loginCaptcha = !!val.loginCaptcha;
        register = !!val.register;
      } catch (e) {}
    }

    return NextResponse.json({
      code: 0,
      data: { loginCaptcha, register },
    });
  } catch (e) {
    return NextResponse.json({
      code: 0,
      data: { loginCaptcha: false, register: false },
    });
  }
}
