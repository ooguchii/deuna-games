import adminStyles from "../../app/admin/admin.module.css";

export default function GameEditorFormActions({
  note,
  action,
  continueTo,
  saveLabel,
  continueLabel,
}: {
  note: string;
  action: string;
  continueTo: string;
  saveLabel: string;
  continueLabel: string;
}) {
  return (
    <div className={adminStyles.formActions}>
      <p>{note}</p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button type="submit">
          {saveLabel}
        </button>
        <button
          type="submit"
          formAction={`${action}?continuar=${encodeURIComponent(continueTo)}`}
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
