import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PostForm } from "@/components/admin/post-form";

export const metadata: Metadata = { title: "New post" };

export default function NewPostPage() {
  return (
    <>
      <Link href="/admin/posts" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> All posts</Link>
      <AdminPageHeader title="New post" description="Write an update for the website. It appears alongside synced Instagram posts." />
      <PostForm />
    </>
  );
}
