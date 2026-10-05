import { FaTelegramPlane, FaVk } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

export type SocialProvider = "google" | "telegram" | "vk";

const providerLabels: Record<SocialProvider, string> = {
  google: "Google",
  telegram: "Telegram",
  vk: "ВКонтакте",
};

function SocialProviderIcon({ provider }: { provider: SocialProvider }) {
  if (provider === "google") return <FcGoogle aria-hidden="true" />;
  if (provider === "telegram") return <FaTelegramPlane aria-hidden="true" />;
  return <FaVk aria-hidden="true" />;
}

export default function SocialAuthButtons({
  providers = ["google", "telegram", "vk"],
  disabled = false,
  onSelect,
}: {
  providers?: readonly SocialProvider[];
  disabled?: boolean;
  onSelect: (provider: SocialProvider) => void;
}) {
  return (
    <div className="auth-socials" aria-label="Вход через социальные сети">
      {providers.map((provider) => (
        <button
          type="button"
          key={provider}
          disabled={disabled}
          onClick={() => onSelect(provider)}
          data-provider={provider}
          aria-label={`Продолжить через ${providerLabels[provider]}`}
        >
          <span className="auth-social-icon">
            <SocialProviderIcon provider={provider} />
          </span>
          <span className="auth-social-label">{providerLabels[provider]}</span>
        </button>
      ))}
    </div>
  );
}
