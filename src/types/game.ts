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

export type GamePlatform =
  | "PC"
  | "PlayStation"
  | "Xbox"
  | "Nintendo Switch";

export type GameDownloadSource = {
  id: string;
  name: string;
  href: string;
  label?: string;
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

  imageAlt: string;

  requirements?: GameRequirements;
  download?: GameDownload;
};
