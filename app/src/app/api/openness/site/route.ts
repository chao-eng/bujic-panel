import { NextResponse } from 'next/server';
import { getSiteBrand } from '../../../../lib/settings';

// GET /api/openness/site —— 登录前公开：返回站点品牌（名称/图标）
export async function GET() {
  try {
    const brand = await getSiteBrand();
    return NextResponse.json({
      code: 0,
      data: {
        name: brand.name || '',
        icon: brand.icon || '',
      },
    });
  } catch (e) {
    return NextResponse.json({ code: 0, data: { name: '', icon: '' } });
  }
}
