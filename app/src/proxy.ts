import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from './lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 放开静态资源、外部上传文件、登录页面及公开API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') || // 文件后缀
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/openness') ||
    pathname.startsWith('/api/crypto') ||  // 加密密钥端点，登录前即需访问
    pathname.startsWith('/uploads')
  ) {
    return NextResponse.next();
  }

  // 2. 获取 Cookie 中的 auth_token
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    // API 路由返回 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ code: 1003, message: '未登录' }, { status: 401 });
    }
    // 网页跳转
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. 校验 JWT
  const payload = await verifyJWT(token);
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ code: 1003, message: '登录已过期' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }

  // 4. 管理员权限保护
  if (pathname.startsWith('/admin') && payload.role !== 1) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
