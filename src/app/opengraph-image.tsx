import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import {
  createSocialImage,
  socialImageAlt,
  socialImageContentType,
} from "@/lib/social-image";

export const alt = socialImageAlt;

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = socialImageContentType;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OpenGraphImage() {
  const config = await getPublicSiteConfig();

  return createSocialImage(config);
}
