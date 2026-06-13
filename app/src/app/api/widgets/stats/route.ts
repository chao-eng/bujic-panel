import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestAuth } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { widgetProviders } from '../../../../lib/widgets/providers';

// 简单超时控制包装函数
function promiseTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('连接超时')), ms)),
  ]);
}

export async function GET(req: NextRequest) {
  // 允许局域网自签名 SSL 证书连接
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  // 1. 验证用户登录状态
  const user = await verifyRequestAuth(req);
  if (!user) {
    return NextResponse.json({ code: 1003, message: '未授权访问' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids');
    if (!idsParam) {
      return NextResponse.json({});
    }

    const bookmarkIds = idsParam.split(',').map(Number).filter(id => !isNaN(id));
    if (bookmarkIds.length === 0) {
      return NextResponse.json({});
    }

    // 2. 在数据库中拉取这些书签
    const bookmarks = await db.itemIcon.findMany({
      where: {
        id: { in: bookmarkIds },
        userId: user.id, // 增加安全性，确保只能访问自己的书签
      },
    });

    // 3. 并发拉取对应组件的数据
    const results: Record<number, { success: boolean; data?: any; error?: string }> = {};
    
    await Promise.all(
      bookmarks.map(async (bk) => {
        if (!bk.widgetType) return;
        const provider = widgetProviders[bk.widgetType];
        if (!provider) {
          results[bk.id] = { success: false, error: `不支持的组件类型: ${bk.widgetType}` };
          return;
        }

        try {
          const settings = JSON.parse(bk.widgetSettings || '{}');
          // 调用对应 Provider 拉取数据 (使用 bk.url 作为 API 基础地址)
          const stats = await promiseTimeout(provider.fetchData(bk.url, settings), 5000);
          results[bk.id] = { success: true, data: stats };
        } catch (err: any) {
          results[bk.id] = { success: false, error: err.message || '数据拉取失败' };
        }
      })
    );

    return NextResponse.json({
      code: 0,
      data: results,
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, message: e.message || '内部服务器错误' }, { status: 500 });
  }
}
