import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function GET() {
  try {
    const disclaimer = await db.systemSetting.findUnique({
      where: { configName: 'disclaimer' },
    });

    const about = await db.systemSetting.findUnique({
      where: { configName: 'web_about_description' },
    });

    return NextResponse.json({
      code: 0,
      data: {
        disclaimer: disclaimer?.configValue || '',
        about: about?.configValue || '',
      },
    });
  } catch (e) {
    return NextResponse.json({
      code: 0,
      data: {
        disclaimer: '',
        about: '',
      },
    });
  }
}
