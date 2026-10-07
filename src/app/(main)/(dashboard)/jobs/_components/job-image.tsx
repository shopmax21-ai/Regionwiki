import Image from "next/image";

import { cn } from "cn";

import { jobImages } from "../_data/job-images";
import type { Job } from "../_data/jobs";
import { fallbackJobIcon, jobIcons } from "./job-icons";

/** Картинка работы 16:9. Берётся из самой работы (поле image), затем из job-images.ts, иначе заглушка с иконкой. */
export function JobImage({
  job,
  sizes,
  priority,
  className,
}: {
  job: Job;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = job.image ?? jobImages[job.slug];
  const Icon = jobIcons[job.slug] ?? fallbackJobIcon;

  return (
    <div className={cn("relative aspect-[16/9] overflow-hidden bg-gradient-to-b from-muted/70 to-muted/20", className)}>
      {src ? (
        <Image
          src={src}
          alt={job.title}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized
          className="object-cover transition-transform duration-300 group-hover/job:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
          <Icon className="size-1/3 stroke-[1]" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
