"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const documentHtml =
  '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="preview"></div></body></html>';

function hashText(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function previewStyleSignature() {
  return Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style')
  )
    .map((node) => {
      if (node instanceof HTMLLinkElement) {
        return `link:${node.href}:${node.media}`;
      }
      const content = node.textContent ?? "";
      return `style:${content.length}:${hashText(content)}`;
    })
    .join("|");
}

async function synchronizePreviewStyles(doc: Document) {
  const previous = Array.from(
    doc.head.querySelectorAll("[data-public-preview-style]")
  );
  const loaded: Promise<void>[] = [];

  for (const node of document.querySelectorAll(
    'link[rel="stylesheet"], style'
  )) {
    const copy = node.cloneNode(true) as HTMLElement;
    copy.setAttribute("data-public-preview-style", "");

    if (copy.tagName === "LINK") {
      loaded.push(
        new Promise((resolve) => {
          copy.addEventListener("load", () => resolve(), {
            once: true,
          });
          copy.addEventListener("error", () => resolve(), {
            once: true,
          });
        })
      );
    }

    doc.head.append(copy);
  }

  await Promise.all(loaded);
  previous.forEach((node) => node.remove());
}

function synchronizeRootIdentity(doc: Document) {
  doc.documentElement.style.cssText =
    document.documentElement.style.cssText;
  doc.documentElement.className =
    document.documentElement.className;
  doc.documentElement.lang = document.documentElement.lang;
  doc.body.style.margin = "0";
  doc.body.style.overflowX = "hidden";
}

export default function IsolatedPublicPreviewFrame({
  width,
  height,
  scale,
  title,
  children,
}: {
  width: number;
  height: number;
  scale: number;
  title: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const lastStyleSignature = useRef("");
  const syncFrame = useRef(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [readyTarget, setReadyTarget] =
    useState<HTMLElement | null>(null);

  const attachFrame = useCallback(
    (frame: HTMLIFrameElement | null) => {
      frameRef.current = frame;
      if (!frame) {
        setTarget(null);
        setReadyTarget(null);
        return;
      }

      const ready = () => {
        setTarget(
          frame.contentDocument?.getElementById("preview") ?? null
        );
      };

      frame.addEventListener("load", ready);
      ready();

      return () => {
        frame.removeEventListener("load", ready);
      };
    },
    []
  );

  useEffect(() => {
    if (!target) return;
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    let disposed = false;

    const synchronize = async (force = false) => {
      const signature = previewStyleSignature();
      if (!force && signature === lastStyleSignature.current) {
        synchronizeRootIdentity(doc);
        return;
      }

      lastStyleSignature.current = signature;
      await synchronizePreviewStyles(doc);
      synchronizeRootIdentity(doc);
      if (!disposed) {
        setReadyTarget(target);
        const view = doc.defaultView;
        if (view) {
          view.dispatchEvent(new view.Event("resize"));
        }
      }
    };

    const scheduleSynchronize = () => {
      window.cancelAnimationFrame(syncFrame.current);
      syncFrame.current = window.requestAnimationFrame(() => {
        void synchronize();
      });
    };

    void synchronize(true);

    const headObserver = new MutationObserver(scheduleSynchronize);
    headObserver.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href", "media"],
    });

    const identityObserver = new MutationObserver(() => {
      synchronizeRootIdentity(doc);
    });
    identityObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class", "lang"],
    });

    const openPublicLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.(
        "a[href]"
      ) as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      event.stopPropagation();
      window.open(link.href, "_blank", "noopener,noreferrer");
    };
    doc.addEventListener("click", openPublicLink, true);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(syncFrame.current);
      headObserver.disconnect();
      identityObserver.disconnect();
      doc.removeEventListener("click", openPublicLink, true);
    };
  }, [target]);

  return (
    <>
      <iframe
        ref={attachFrame}
        title={title}
        srcDoc={documentHtml}
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          border: 0,
          position: "absolute",
          left: "50%",
          marginLeft: -(width * scale) / 2,
        }}
      />
      {target && readyTarget === target
        ? createPortal(children, target)
        : null}
    </>
  );
}
