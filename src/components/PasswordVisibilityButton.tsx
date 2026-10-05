import { FiEye, FiEyeOff } from "react-icons/fi";

export default function PasswordVisibilityButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  const label = visible ? "Скрыть пароль" : "Показать пароль";

  return (
    <button
      type="button"
      className="auth-password-toggle"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={visible}
      title={label}
    >
      {visible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
    </button>
  );
}
