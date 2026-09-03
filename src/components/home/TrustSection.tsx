import {
  Monitor,
  RefreshCcw,
  Shield,
  Zap,
} from "lucide-react";

import type { HomeCopy } from "@/data/home-config";

import styles from "./TrustSection.module.css";

const icons = [RefreshCcw, Monitor, Shield, Zap] as const;

export default function TrustSection({
  copy,
}: {
  copy: HomeCopy["trust"];
}) {
  return (
    <section className={styles.section}>
      {copy.items.map((item, index) => {
        const Icon = icons[index];

        return (
          <div
            className={styles.item}
            key={`${index}-${item.title}`}
          >
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
