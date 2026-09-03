import GameMultimediaWorkspaceContextual from "@/components/admin/GameMultimediaWorkspaceContextual";
import GameVideoLibraryEditor from "@/components/admin/GameVideoLibraryEditor";
import RequiredMediaGate from "@/components/admin/RequiredMediaGate";

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
    <div id="multimedia-order-root">
      <style>{`
        #multimedia-order-root div:has(> section #shared-library-heading):has(> section #destination-assignment-heading) {
          display: flex !important;
          flex-direction: column;
        }
        #multimedia-order-root section:has(#destination-assignment-heading) {
          order: 1;
        }
        #multimedia-order-root section:has(#shared-library-heading) {
          order: 2;
        }
        #multimedia-order-root section:has(#destination-assignment-heading) > div:first-child > div:first-child > span:first-child,
        #multimedia-order-root section:has(#shared-library-heading) > div:first-child > div:first-child > span:first-child {
          font-size: 0;
        }
        #multimedia-order-root section:has(#destination-assignment-heading) > div:first-child > div:first-child > span:first-child::after {
          content: "01";
          font-size: 12px;
        }
        #multimedia-order-root section:has(#shared-library-heading) > div:first-child > div:first-child > span:first-child::after {
          content: "02";
          font-size: 12px;
        }
      `}</style>

      <RequiredMediaGate slug={slug} />

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
  );
}