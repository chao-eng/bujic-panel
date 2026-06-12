import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    
    let uploadBaseDir: string | undefined;
    if (process.env.DATA_DIR) {
      uploadBaseDir = path.join(process.env.DATA_DIR, 'uploads');
    } else {
      uploadBaseDir = process.env.UPLOAD_DIR;
    }

    if (!uploadBaseDir) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const filePath = path.join(uploadBaseDir, ...pathSegments);

    // 防止目录穿越攻击
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(uploadBaseDir);
    if (!resolvedPath.startsWith(resolvedBase)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    
    let contentType = 'application/octet-stream';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.ico') contentType = 'image/x-icon';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || 'Internal Error', { status: 500 });
  }
}
