import type { ReactNode } from "react";

import GameMultimediaWorkspaceContextual from "@/components/admin/GameMultimediaWorkspaceContextual";

type GameMultimediaEditorProps = {
  slug: string;
  revision: number;
  mediaAction: string;
  coverImage?: string;
  heroImage?: string;
  screenshots?: readonly string[];
  videoEditor: ReactNode;
};

export default function GameMultimediaEditor({
  slug,
  revision,
  coverImage,
  heroImage,
  screenshots = [],
  videoEditor,
}: GameMultimediaEditorProps) {
  return (
    <GameMultimediaWorkspaceContextual
      slug={slug}
      revision={revision}
      screenshotCount={screenshots.length}
      initialCoverImage={coverImage}
      initialHeroImage={heroImage}
      initialScreenshots={screenshots}
      videoEditor={videoEditor}
    />
  );
}
