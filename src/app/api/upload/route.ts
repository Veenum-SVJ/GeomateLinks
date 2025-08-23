// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  const data = await request.formData();
  const file: File | null = data.get('file') as unknown as File;

  if (!file) {
    return NextResponse.json({ success: false, error: "No file found" });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Storing files in the `public` directory makes them accessible via URL.
  const path = join(process.cwd(), 'public', 'uploads', file.name);
  
  try {
    await writeFile(path, buffer);
    console.log(`File saved to ${path}`);
    
    // The URL to access the file will be /uploads/filename
    const url = `/uploads/${file.name}`;
    
    return NextResponse.json({ success: true, url });

  } catch (error) {
    console.error("Error saving file:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `Failed to save file: ${errorMessage}` }, { status: 500 });
  }
}
