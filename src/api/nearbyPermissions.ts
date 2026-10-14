// Keep location in memory only. Startup and a first shake share one browser
// request, including React StrictMode's repeated development effects.
let inFlight: Promise<GeolocationPosition> | null = null;
let cached: { position: GeolocationPosition; receivedAt: number } | null = null;

export function getNearbyLocation(fresh = false): Promise<GeolocationPosition> {
  if (!window.isSecureContext) return Promise.reject(new Error("Для геолокации откройте сайт по HTTPS."));
  if (!navigator.geolocation) return Promise.reject(new Error("Этот браузер не поддерживает геолокацию. Попробуйте Safari или Chrome."));
  if (inFlight) return inFlight;
  if (!fresh && cached && Date.now() - cached.receivedAt < 60000) return Promise.resolve(cached.position);
  inFlight = new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(position => {
    cached = { position, receivedAt: Date.now() };
    resolve(position);
  }, error => {
    const messages: Record<number, string> = {
      1: "Доступ к геопозиции закрыт. Разрешите его для этого сайта в настройках браузера и повторите поиск.",
      2: "Не удалось определить местоположение. Проверьте, включена ли геолокация на телефоне, и попробуйте ещё раз.",
      3: "Определение местоположения заняло слишком много времени. Попробуйте ещё раз у окна или на улице.",
    };
    reject(new Error(messages[error.code] ?? "Не удалось определить местоположение. Попробуйте ещё раз."));
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: fresh ? 0 : 60000 })).finally(() => { inFlight = null; });
  return inFlight;
}
