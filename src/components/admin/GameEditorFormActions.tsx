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
    <div className={`${adminStyles.formActions} admin-form-actions`}>
      <p>{note}</p>
      <div className="admin-form-actions__buttons">
        <button
          type="submit"
          className="admin-form-action admin-form-action--secondary"
        >
          {saveLabel}
        </button>
        <button
          type="submit"
          className="admin-form-action admin-form-action--primary"
          formAction={`${action}?continuar=${encodeURIComponent(continueTo)}`}
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
