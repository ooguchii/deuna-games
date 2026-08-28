import { ImageResponse } from "next/og";

export const socialImageAlt =
  "DeUna Games - Encuentra juegos para tu PC";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

export const socialImageContentType = "image/png";

export function createSocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          color: "#f7f8fb",
          background:
            "linear-gradient(135deg, #05060b 0%, #0b0f19 52%, #160812 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 560,
            height: 560,
            right: -100,
            top: -180,
            borderRadius: 9999,
            background: "rgba(255, 8, 71, 0.18)",
            filter: "blur(80px)",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            left: -120,
            bottom: -220,
            borderRadius: 9999,
            background: "rgba(123, 97, 255, 0.12)",
            filter: "blur(90px)",
          }}
        />

        <div
          style={{
            width: "100%",
            padding: "78px 88px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            <div
              style={{
                width: 66,
                height: 66,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 18,
                border: "1px solid rgba(255, 8, 71, 0.55)",
                background: "rgba(255, 8, 71, 0.08)",
                color: "#ff0847",
                fontSize: 34,
              }}
            >
              🎮
            </div>

            <div style={{ display: "flex" }}>
              <span>DeUna&nbsp;</span>
              <span style={{ color: "#ff0847" }}>Games</span>
            </div>
          </div>

          <div
            style={{
              maxWidth: 910,
              display: "flex",
              flexDirection: "column",
              gap: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                fontSize: 76,
                lineHeight: 1.02,
                letterSpacing: "-0.045em",
                fontWeight: 900,
              }}
            >
              <span>Encuentra juegos para&nbsp;</span>
              <span style={{ color: "#ff0847" }}>tu PC</span>
            </div>

            <div
              style={{
                display: "flex",
                maxWidth: 820,
                color: "#b8c1cf",
                fontSize: 27,
                lineHeight: 1.42,
              }}
            >
              Juegos, requisitos, versiones y actualizaciones
              en un solo lugar.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              color: "#7d8898",
              fontSize: 20,
            }}
          >
            <span>Juegos para PC</span>
            <span>•</span>
            <span>Compatibilidad</span>
            <span>•</span>
            <span>Actualizaciones</span>
          </div>
        </div>
      </div>
    ),
    socialImageSize
  );
}
