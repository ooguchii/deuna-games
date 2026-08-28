import {
  Monitor,
  RefreshCcw,
  Shield,
  Zap,
} from "lucide-react";

import styles from "./TrustSection.module.css";

const items = [
  {
    title: "Versiones identificadas",
    text: "Cuando un juego tiene una versión registrada, la mostramos junto con su información.",
    icon: RefreshCcw,
  },
  {
    title: "Requisitos claros",
    text: "Cuando hay requisitos disponibles, puedes consultarlos rápidamente desde el catálogo.",
    icon: Monitor,
  },
  {
    title: "Contenido organizado",
    text: "Cada juego, versión y actualización en su lugar.",
    icon: Shield,
  },
  {
    title: "Rápido y directo",
    text: "Menos vueltas y más tiempo descubriendo qué jugar.",
    icon: Zap,
  },
];

export default function TrustSection() {
  return (
    <section className={styles.section}>
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div className={styles.item} key={item.title}>
            <div className={styles.icon}>
              <Icon size={25} />
            </div>

            <div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
