import { AppBar } from "../components/m3/AppBar";

export function ProfilePage() {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <AppBar title="O aplikácii" />
      <div className="app-content px-4 pt-2">
        <div className="m3-card-outlined p-5">
          <p className="text-sm text-surface-on leading-relaxed m-0">
            AI, ktorá v spise nájde rozpor a nemožné alibi. Rozhodnutia ostávajú na
            vás.
          </p>
        </div>
      </div>
    </div>
  );
}
