import Image from "next/image";
import Link from "next/link";
import { InstagramIcon as Instagram } from "@/components/icons/instagram";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type PostCardData = {
  id: string;
  slug: string;
  title: string;
  caption: string | null;
  imageUrl: string | null;
  source: "WEBSITE" | "INSTAGRAM";
  instagramUrl: string | null;
  publishedAt: Date | null;
};

export function PostCard({ post }: { post: PostCardData }) {
  const href = post.source === "INSTAGRAM" && post.instagramUrl ? post.instagramUrl : `/posts/${post.slug}`;
  const external = href.startsWith("http");
  const date = post.publishedAt
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(post.publishedAt)
    : null;

  const inner = (
    <Card className="group h-full overflow-hidden rounded-2xl p-0 shadow-soft transition-shadow hover:shadow-lift">
      <div className="relative aspect-[4/3] bg-sand">
        {post.imageUrl ? (
          <Image src={post.imageUrl} alt={post.title} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center text-brand-deep/40"><Instagram className="size-10" strokeWidth={1.25} aria-hidden /></div>
        )}
        {post.source === "INSTAGRAM" && (
          <Badge className="absolute top-3 left-3 gap-1 bg-card/90 text-foreground backdrop-blur" variant="secondary"><Instagram className="size-3" aria-hidden /> Instagram</Badge>
        )}
      </div>
      <CardContent className="p-5">
        {date && <p className="text-xs text-muted-foreground">{date}</p>}
        <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug">{post.title}</h3>
        {post.caption && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.caption}</p>}
      </CardContent>
    </Card>
  );

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">{inner}</a>
  ) : (
    <Link href={href} className="block h-full">{inner}</Link>
  );
}
