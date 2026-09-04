import GameGalleryMediaManager from "@/components/admin/GameGalleryMediaManager";
import GameMultimediaUtilityRail from "@/components/admin/GameMultimediaUtilityRail";
import GameMultimediaWorkspaceContextual from "@/components/admin/GameMultimediaWorkspaceContextual";
import GameVideoLibraryEditor from "@/components/admin/GameVideoLibraryEditor";

import refinementStyles from "./GameMultimediaLayoutRefinements.module.css";
import shellStyles from "./GameMultimediaShell.module.css";

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
    <div className={shellStyles.workspaceShell}>
      <div className={shellStyles.mainColumn}>
        <div
          className={`${shellStyles.legacyWorkspaceHost} ${refinementStyles.assignmentHost}`}
        >
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
        </div>

        <GameGalleryMediaManager
          slug={slug}
          revision={revision}
        />
      </div>

      <GameMultimediaUtilityRail
        slug={slug}
        revision={revision}
        screenshotCount={screenshots.length}
      />
    </div>
  );
}
