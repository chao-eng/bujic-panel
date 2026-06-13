import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestAuth } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const user = await verifyRequestAuth(req);
  if (!user) {
    return NextResponse.json({ code: 1003, message: '未授权访问' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const fileType = (formData.get('fileType') as string) || 'icon'; // icon | wallpaper

    if (!file) {
      return NextResponse.json({ code: 1001, message: '未找到上传的文件' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 上传限制为最多 10MB 文件大小
    if (buffer.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json({ code: 1002, message: '文件体积超出限制 (最大 10MB)' }, { status: 400 });
    }

    const now = new Date();
    const relativeDir = `uploads/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    
    let uploadDir: string;
    if (process.env.DATA_DIR) {
      uploadDir = path.join(/*turbopackIgnore: true*/ process.env.DATA_DIR, relativeDir);
    } else if (process.env.UPLOAD_DIR) {
      const subDir = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
      uploadDir = path.join(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR, subDir);
    } else {
      uploadDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', relativeDir);
    }

    // 确保上传物理目录存在
    fs.mkdirSync(/*turbopackIgnore: true*/ uploadDir, { recursive: true });

    // 文件命名：内容 MD5 + 物理后缀
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    let ext = path.extname(file.name);
    if (!ext) ext = '.png'; // 默认 png
    const filename = `${hash}${ext}`;
    const filepath = path.join(/*turbopackIgnore: true*/ uploadDir, filename);

    // 物理写盘
    fs.writeFileSync(/*turbopackIgnore: true*/ filepath, buffer);

    const relativeSrc = `/${relativeDir}/${filename}`;

    // 注册到数据库的 File 表中
    const fileRecord = await db.file.create({
      data: {
        src: relativeSrc,
        userId: user.id,
        fileName: file.name,
        ext,
        fileType,
        method: 1,
      },
    });

    return NextResponse.json({
      code: 0,
      data: fileRecord,
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, message: e.message || '内部错误' }, { status: 500 });
  }
}
