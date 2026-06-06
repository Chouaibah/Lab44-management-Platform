import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getSession, sanitizeFilename } from "@/lib/auth";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "documents");
const IMAGES_DIR = path.join(process.cwd(), "uploads", "images");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
    }

    const document = await db.labDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // Check what type of file is being requested (document or image)
    const url = new URL(request.url);
    const serveImage = url.searchParams.get("type") === "image";

    if (serveImage && document.imageUrl) {
      // Serve image file
      const imagePath = path.join(IMAGES_DIR, document.imageUrl);
      const resolvedPath = path.resolve(imagePath);
      const resolvedDir = path.resolve(IMAGES_DIR);

      if (!resolvedPath.startsWith(resolvedDir)) {
        return NextResponse.json({ error: "Invalid file path." }, { status: 403 });
      }

      if (!existsSync(resolvedPath)) {
        return NextResponse.json({ error: "Image not found on server." }, { status: 404 });
      }

      const fileBuffer = await readFile(resolvedPath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": document.imageType || "image/jpeg",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Serve document file (download)
    if (!document.filePath) {
      return NextResponse.json({ error: "No file attached to this post." }, { status: 404 });
    }

    const filePath = path.join(UPLOADS_DIR, document.filePath);
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsDir = path.resolve(UPLOADS_DIR);

    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      return NextResponse.json({ error: "Invalid file path." }, { status: 403 });
    }

    if (!existsSync(resolvedPath)) {
      return NextResponse.json({ error: "File not found on server." }, { status: 404 });
    }

    const fileBuffer = await readFile(resolvedPath);
    const safeFilename = sanitizeFilename(document.title);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": document.fileType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
      },
    });
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json({ error: "Failed to download document." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "instructor")) {
      return NextResponse.json({ error: "Admin or instructor access required." }, { status: 403 });
    }

    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
    }

    const data = await request.json();

    const updateData: Record<string, unknown> = {};
    if (typeof data.title === "string") updateData.title = data.title.trim();
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (typeof data.visibleToStudents === "boolean") {
      updateData.visibleToStudents = data.visibleToStudents;
    }
    if (typeof data.linkUrl === "string") {
      updateData.linkUrl = data.linkUrl.trim() || null;
    }
    if (typeof data.linkTitle === "string") {
      updateData.linkTitle = data.linkTitle.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const document = await db.labDocument.update({
      where: { id: documentId },
      data: updateData,
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
    console.error("Document update error:", error);
    return NextResponse.json({ error: "Failed to update document." }, { status: 500 });
  }
}
