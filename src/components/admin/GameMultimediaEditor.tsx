import GameMultimediaWorkspaceContextual from "@/components/admin/GameMultimediaWorkspaceContextual";
import GameVideoLibraryEditor from "@/components/admin/GameVideoLibraryEditor";

type GameMultimediaEditorProps = {
  slug: string;
  revision: number;
  coverImage?: string;
  heroImage?: string;
  screenshots?: readonly string[];
};

export default function GameMultimediaEditor({
  slug,
  revision,
  coverImage,
  heroImage,
  screenshots = [],
}: GameMultimediaEditorProps) {
  return (
    <GameMultimediaWorkspaceContextual
      slug={slug}
      revision={revision}
      screenshotCount={screenshots.length}
      initialCoverImage={coverImage}
      initialHeroImage={heroImage}
      initialScreenshots={screenshots}
      videoEditor={
        <GameVideoLibraryEditor
          slug={slug}
          revision={revision}
        />
      }
    />
  );
}
