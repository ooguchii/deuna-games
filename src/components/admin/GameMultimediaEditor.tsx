import GameGalleryMediaManager from "@/components/admin/GameGalleryMediaManager";
import GameMediaAccessibilityEditor from "@/components/admin/GameMediaAccessibilityEditor";
import GameMediaAssignmentsWorkspace from "@/components/admin/GameMediaAssignmentsWorkspace";
import GameMultimediaUtilityRail from "@/components/admin/GameMultimediaUtilityRail";

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
  screenshots = [],
}: GameMultimediaEditorProps) {
  return (
    <div className={shellStyles.workspaceShell}>
      <div className={shellStyles.mainColumn}>
        <div
          className={`${shellStyles.legacyWorkspaceHost} ${refinementStyles.assignmentHost}`}
        >
          <GameMediaAssignmentsWorkspace
            slug={slug}
            revision={revision}
          />
        </div>

        <GameGalleryMediaManager
          slug={slug}
          revision={revision}
        />

        <GameMediaAccessibilityEditor
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
