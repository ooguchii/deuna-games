export type GameHardwareRequirements = {
  ram?: string;
  graphics?: string;
  processor?: string;
  storage?: string;
  system?: string;
};

export type GameRequirements =
  GameHardwareRequirements & {
    /*
     * Compatibilidad hacia atrás: la Home actual todavía usa requirements.ram,
     * requirements.graphics, etc. Las páginas internas podrán migrar
     * gradualmente a requirements.minimum / requirements.recommended.
     */
    minimum?: GameHardwareRequirements;
    recommended?: GameHardwareRequirements;
  };

export type GamePerformanceCalibration = {
  /* FPS observados o calibrados sobre el equipo de referencia a 1080p/media. */
  referenceFps: number;
  ramGb: number;
  fpsCap?: number;
};

export type GamePlatform =
  | "PC"
  | "PlayStation"
  | "Xbox"
  | "Nintendo Switch";

export type GameDownloadSourceStatus =
  | "available"
  | "down"
  | "maintenance";

export type GameDownloadSource = {
  id: string;
  name: string;
  href: string;
  label?: string;
  enabled?: boolean;
  status?: GameDownloadSourceStatus;
};

export type GameDownload = {
  href?: string;
  label?: string;
  sources?: GameDownloadSource[];
  sizeGb?: number;
  fileCount?: number;
  platform?: string;
};

export type GameDirectPreviewPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "vimeo"
  | "x"
  | "twitch"
  | "dailymotion"
  | "streamable"
  | "kick";

export type GamePreviewMode =
  | "webm"
  | "youtube"
  | GameDirectPreviewPlatform;

export type GameYouTubePreview = {
  videoId: string;
  startSeconds: number;
  endSeconds: number;
};

export type GameDirectPreview = {
  platform: GameDirectPreviewPlatform;
  url: string;
  startSeconds: number;
  endSeconds: number;
};

export type GameImageViewport = {
  /* Punto de interés normalizado dentro de la imagen. */
  x: number;
  y: number;
  /* 1 = encuadre base; 3 = zoom máximo 300 %. */
  zoom: number;
  /* Sólo true significa que el editor confirmó explícitamente este recorte. */
  confirmed?: true;
};

export type GameImageMedia = {
  /* Cada destino conserva su encuadre sin duplicar ni modificar la imagen. */
  cover?: GameImageViewport;
  hero?: GameImageViewport;
  card?: GameImageViewport;
  /* La galería guarda un encuadre por recurso asignado. */
  gallery?: Record<string, GameImageViewport>;
};

export type GameVideoViewportAspect =
  | "source"
  | "16:9"
  | "3:2"
  | "1:1"
  | "4:5"
  | "9:16";

export type GameVideoViewport = {
  /* Posición normalizada dentro del área desplazable del encuadre. */
  x: number;
  y: number;
  /* 1 = fotograma completo; 3 = zoom máximo 300 %. */
  zoom: number;
  aspect: GameVideoViewportAspect;
  /* Ausente = asignado pero todavía pendiente de confirmar en el editor. */
  confirmed?: true;
};

export type GameDestinationMediaMode =
  | "image"
  | "video"
  | "hover-video";

export type GameMediaModes = {
  /* Defaults editoriales: Portada=video, Hero/Card=hover-video. */
  cover?: GameDestinationMediaMode;
  hero?: GameDestinationMediaMode;
  card?: GameDestinationMediaMode;
};

export type GameVideoPlayback = "always" | "hover";
export type GameHeroVideoPlayback = GameVideoPlayback;

export type GameDestinationVideo = {
  clip: string;
  viewport: GameVideoViewport;
  /* Ausente conserva compatibilidad histórica: video siempre activo. */
  playback?: GameVideoPlayback;
};

export type GameCoverVideo = GameDestinationVideo;
export type GameHeroVideo = GameDestinationVideo;

export type GameCardVideo =
  | {
      /* Compatibilidad histórica: puede referenciar los mismos bytes que Hero. */
      source: "hero";
      viewport: GameVideoViewport;
      playback?: GameVideoPlayback;
    }
  | {
      /* Modo editorial actual: la Card selecciona explícitamente su recurso. */
      source: "independent";
      clip: string;
      viewport: GameVideoViewport;
      playback?: GameVideoPlayback;
    };

export type GameVideoMedia = {
  cover?: GameCoverVideo;
  hero?: GameHeroVideo;
  card?: GameCardVideo;
};

export type Game = {
  id: string;
  slug: string;

  title: string;
  shortTitle?: string;
  highlightedTitle?: string;

  description: string;

  /* category se conserva para no romper la Home; genres permite más de uno. */
  category: string;
  genres?: string[];
  tags?: string[];
  platforms?: GamePlatform[];

  badge?: string;

  rating?: number;
  reviews?: string;

  version?: string;
  addedAt?: string;
  releaseDate?: string;

  developer?: string;
  publisher?: string;

  coverImage?: string;
  heroImage?: string;
  /* La Card tiene recurso base propio; nunca depende de cambios posteriores de Portada. */
  cardImage?: string;
  screenshots?: string[];

  /*
   * imageMedia guarda sólo instrucciones de presentación. Portada, Hero,
   * Card y cada imagen de Galería pueden reutilizar el mismo archivo físico
   * con encuadres distintos.
   */
  imageMedia?: GameImageMedia;

  /*
   * mediaModes expresa de forma explícita qué capa usa cada destino. Así se
   * puede conservar una imagen base y un video simultáneamente para hover sin
   * inferir el modo por la mera existencia del recurso.
   */
  mediaModes?: GameMediaModes;

  /*
   * videoMedia conserva masters editoriales por destino. Compartir el mismo
   * archivo físico sigue siendo posible seleccionando el mismo recurso desde
   * la biblioteca; los encuadres permanecen independientes como metadata.
   */
  videoMedia?: GameVideoMedia;

  /*
   * Los orígenes pueden coexistir. previewMode decide cuál usa la card.
   * YouTube conserva su contrato específico ya probado; las demás redes
   * directas usan directPreview con una plataforma explícita.
   */
  previewMode?: GamePreviewMode;
  previewClip?: string;
  youtubePreview?: GameYouTubePreview;
  directPreview?: GameDirectPreview;

  imageAlt: string;

  requirements?: GameRequirements;
  performance?: GamePerformanceCalibration;
  download?: GameDownload;
};