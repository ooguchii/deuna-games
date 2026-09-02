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
     * Compatibilidad hacia atrás:
     * la Home actual todavía usa requirements.ram,
     * requirements.graphics, etc.
     *
     * Las páginas internas podrán migrar gradualmente a:
     * requirements.minimum
     * requirements.recommended
     */
    minimum?: GameHardwareRequirements;
    recommended?: GameHardwareRequirements;
  };

export type GamePerformanceCalibration = {
  /*
   * FPS observados o calibrados sobre el equipo de referencia del modelo
   * a 1080p / calidad media. Se mantiene dentro del payload editorial para
   * que juegos creados desde el panel puedan estimar rendimiento sin exigir
   * una entrada nueva en el código fuente.
   */
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
  /*
   * El orden del array define el orden editorial en la página.
   * enabled=false permite conservar una fuente sin mostrarla.
   * status permite informar una caída sin eliminar el destino.
   */
  enabled?: boolean;
  status?: GameDownloadSourceStatus;
};

export type GameDownload = {
  /*
   * href se conserva para compatibilidad con juegos ya configurados.
   * sources permite ofrecer varias fuentes sin acoplar el modelo a
   * proveedores concretos como MEGA, Drive o MediaFire.
   */
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

export type GameVideoViewportAspect =
  | "source"
  | "16:9"
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
};

export type GameHeroVideo = {
  clip: string;
  viewport: GameVideoViewport;
};

export type GameCardVideo =
  | {
      /* La Card referencia exactamente los mismos bytes que el Hero. */
      source: "hero";
      viewport: GameVideoViewport;
    }
  | {
      /* La Card conserva un WebM propio únicamente cuando se solicita. */
      source: "independent";
      clip: string;
      viewport: GameVideoViewport;
    };

export type GameVideoMedia = {
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

  /*
   * category se conserva para no romper la Home.
   * genres permite que un juego tenga más de un género
   * cuando completemos las fichas internas.
   */
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
  screenshots?: string[];

  /*
   * videoMedia es el contrato nuevo: el Hero guarda un único master temporal
   * y la Card puede referenciarlo sin copiarlo o mantener un master propio.
   * Los encuadres son metadata de presentación y nunca obligan a duplicar el
   * archivo físico. Los campos preview* siguientes permanecen como fallback
   * de payloads históricos y como reserva de una Card independiente previa.
   */
  videoMedia?: GameVideoMedia;

  /*
   * Los orígenes pueden coexistir. previewMode decide cuál usa la card.
   * YouTube conserva su contrato específico ya probado; las demás redes
   * directas usan directPreview con una plataforma explícita para impedir
   * que una URL termine accidentalmente en el adaptador de otra red.
   * Si falta previewMode (payloads históricos), previewClip mantiene la
   * prioridad anterior y se considera WebM activo.
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