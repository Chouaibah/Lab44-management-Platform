import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { getSession } from "@/lib/auth";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "documents");
const IMAGES_DIR = path.join(process.cwd(), "uploads", "images");

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;
    const labId = parseInt(id);

    if (isNaN(labId)) {
      return NextResponse.json({ error: "Invalid lab ID." }, { status: 400 });
    }

    // If student, only return visible posts
    const where: Record<string, unknown> = { labId };
    if (session.role === "student") {
      where.visibleToStudents = true;
    }

    const documents = await db.labDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        fileType: doc.fileType,
        filePath: doc.filePath,
        imageUrl: doc.imageUrl,
        imageType: doc.imageType,
        linkUrl: doc.linkUrl,
        linkTitle: doc.linkTitle,
        visibleToStudents: doc.visibleToStudents,
        createdAt: doc.createdAt.toISOString(),
        labId: doc.labId,
      })),
    });
  } catch (error) {
    console.error("Documents get error:", error);
    return NextResponse.json({ error: "Failed to load documents." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { id } = await params;
    const labId = parseInt(id);

    if (isNaN(labId)) {
      return NextResponse.json({ error: "Invalid lab ID." }, { status: 400 });
    }

    const lab = await db.lab.findUnique({ where: { id: labId } });
    if (!lab) {
      return NextResponse.json({ error: "Lab not found." }, { status: 404 });
    }

    ensureDir(UPLOADS_DIR);
    ensureDir(IMAGES_DIR);

    const formData = await request.formData();
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const file = formData.get("file") as File | null;
    const image = formData.get("image") as File | null;
    const linkUrl = formData.get("linkUrl") as string | null;
    const linkTitle = formData.get("linkTitle") as string | null;
    const visibleToStudents = formData.get("visibleToStudents") === "true";

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    // Validate at least one content element is provided
    if (!file && !image && !description?.trim() && !linkUrl?.trim()) {
      return NextResponse.json({ error: "At least one content element (file, image, description, or link) is required." }, { status: 400 });
    }

    // Handle PDF/document upload
    let savedFilePath: string | null = null;
    let savedFileType: string | null = null;
    if (file) {
      const allowedDocTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
      ];
      if (!allowedDocTypes.includes(file.type)) {
        return NextResponse.json(
          { error: "Invalid file type. Only PDF, Word, PowerPoint, and text files are allowed." },
          { status: 400 }
        );
      }
      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large. Maximum size is 20MB." }, { status: 400 });
      }
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${labId}_${timestamp}_${safeName}`;
      const fullFilePath = path.join(UPLOADS_DIR, fileName);
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(fullFilePath, buffer);
      savedFilePath = fileName;
      savedFileType = file.type;
    }

    // Handle image upload
    let savedImageUrl: string | null = null;
    let savedImageType: string | null = null;
    if (image) {
      const allowedImageTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];
      if (!allowedImageTypes.includes(image.type)) {
        return NextResponse.json(
          { error: "Invalid image type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed." },
          { status: 400 }
        );
      }
      if (image.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Image too large. Maximum size is 10MB." }, { status: 400 });
      }
      const timestamp = Date.now();
      const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const imageName = `${labId}_${timestamp}_img_${safeName}`;
      const fullImagePath = path.join(IMAGES_DIR, imageName);
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(fullImagePath, buffer);
      savedImageUrl = imageName;
      savedImageType = image.type;
    }

    // Validate link URL
    if (linkUrl?.trim() && !/^https?:\/\/.+/.test(linkUrl.trim())) {
      // Clean up uploaded files before returning error
      if (savedFilePath) { const p = path.join(UPLOADS_DIR, savedFilePath); if (existsSync(p)) await unlink(p); }
      if (savedImageUrl) { const p = path.join(IMAGES_DIR, savedImageUrl); if (existsSync(p)) await unlink(p); }
      return NextResponse.json({ error: "Link URL must start with http:// or https://" }, { status: 400 });
    }

    const document = await db.labDocument.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        filePath: savedFilePath,
        fileType: savedFileType,
        imageUrl: savedImageUrl,
        imageType: savedImageType,
        linkUrl: linkUrl?.trim() || null,
        linkTitle: linkTitle?.trim() || null,
        labId,
        visibleToStudents,
      },
    });

    return NextResponse.json({
      ok: true,
      document: {
        id: document.id,
        title: document.title,
        description: document.description,
        fileType: document.fileType,
        filePath: document.filePath,
        imageUrl: document.imageUrl,
        imageType: document.imageType,
        linkUrl: document.linkUrl,
        linkTitle: document.linkTitle,
        visibleToStudents: document.visibleToStudents,
        createdAt: document.createdAt.toISOString(),
        labId: document.labId,
      },
    });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json({ error: "Failed to create post." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "instructor") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { id } = await params;
    const labId = parseInt(id);

    if (isNaN(labId)) {
      return NextResponse.json({ error: "Invalid lab ID." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const documentIdParam = searchParams.get("documentId");

    if (!documentIdParam) {
      return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
    }

    const documentId = parseInt(documentIdParam);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
    }

    const document = await db.labDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    if (document.labId !== labId) {
      return NextResponse.json({ error: "Document does not belong to this lab." }, { status: 403 });
    }

    // Clean up file
    if (document.filePath) {
      const filePath = path.join(UPLOADS_DIR, document.filePath);
      if (existsSync(filePath)) await unlink(filePath);
    }
    // Clean up image
    if (document.imageUrl) {
      const imagePath = path.join(IMAGES_DIR, document.imageUrl);
      if (existsSync(imagePath)) await unlink(imagePath);
    }

    await db.labDocument.delete({
      where: { id: documentId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Document delete error:", error);
    return NextResponse.json({ error: "Failed to delete document." }, { status: 500 });
  }
}
