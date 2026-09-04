import type {
  GameBackgroundVideo,
  GameCardVideo,
  GameCoverVideo,
  GameDestinationMediaMode,
  GameDetailVideo,
  GameHeroVideo,
  GameImageMedia,
} from "@/types/game";

export type MultimediaResourceImage = {
  kind: "image";
  origin: "editorial" | "bundled";
  src: string;
  digest: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
};

export type MultimediaResourceVideo = {
  kind: "video";
  origin: "editorial";
  src: string;
  digest: string;
  bytes: number;
};

export type MultimediaLibraryResource =
  | MultimediaResourceImage
  | MultimediaResourceVideo;

export type MultimediaLibraryState = {
  revision: number;
  resources: MultimediaLibraryResource[];
  assignments: {
    coverImage: string | null;
    heroImage: string | null;
    cardImage: string | null;
    detailImage: string | null;
    backgroundImage: string | null;
    screenshots: string[];
    imageMedia: GameImageMedia | null;
    coverMode: GameDestinationMediaMode;
    heroMode: GameDestinationMediaMode;
    cardMode: GameDestinationMediaMode;
    detailMode: GameDestinationMediaMode;
    backgroundMode: GameDestinationMediaMode | null;
    coverVideo: GameCoverVideo | null;
    heroVideo: GameHeroVideo | null;
    cardVideo: GameCardVideo | null;
    detailVideo: GameDetailVideo | null;
    backgroundVideo: GameBackgroundVideo | null;
    legacyPreviewClip: string | null;
  };
};

export function formatMultimediaBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function multimediaShortName(src: string) {
  const filename = src.split("/").filter(Boolean).at(-1) ?? src;
  if (filename.length <= 24) return filename;
  return `${filename.slice(0, 11)}…${filename.slice(-10)}`;
}
