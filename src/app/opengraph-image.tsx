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

export default function OpenGraphImage() {
  return createSocialImage();
}
