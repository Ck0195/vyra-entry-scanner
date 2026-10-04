import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import logo from "./assets/logo.webp";

type Result = {
  success?: boolean;
  alreadyUsed?: boolean;
  notFound?: boolean;
  id?: string;
  name?: string;
  passType?: string;
  scannedAt?: string;
  message?: string;
};

/* Same Apps Script deployment that generates the passes (index.html) */
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby4H4DKhAQ5wtGGGxidRmhz4Obr9W0-s9rGy7KFjIO5LE3Rv6vDXwLR6WzaD0XXIeo/exec";

/* Pull a Pass ID like VYRA-AB12CD out of whatever the QR / input contains */
function normalize(value: string) {
  const raw = value.trim().toUpperCase();
  const match = raw.match(/(?:VYRA|PASS)-[A-Z0-9]+/);
  return match ? match[0] : raw;
}

function isPassId(id: string) {
  return /^(?:VYRA|PASS)-[A-Z0-9]+$/.test(id);
}

/* Calls the Apps Script "scan" action (JSONP, so no CORS problems) */
function scanPassWithGoogle(passId: string): Promise<Result> {
  return new Promise((resolve) => {
    const w = window as unknown as Record<string, unknown>;
    const callbackName =
      "vyraScan_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    const script = document.createElement("script");

    function cleanup() {
      window.clearTimeout(timer);
      delete w[callbackName];
      script.remove();
    }

    const timer = window.setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        message: "Connection timed out. Check the internet and scan again.",
      });
    }, 15000);

    w[callbackName] = (response: Result) => {
      cleanup();
      resolve(response);
    };

    script.src =
      APPS_SCRIPT_URL +
      "?action=scan" +
      "&passId=" + encodeURIComponent(passId) +
      "&callback=" + callbackName +
      "&_=" + Date.now();

    script.onerror = () => {
      cleanup();
      resolve({
        success: false,
        message: "Could not connect to Google Sheets.",
      });
    };

    document.body.appendChild(script);
  });
}

export default function App() {
  const scanner = useRef<Html5Qrcode | null>(null);
  const scanning = useRef(false);
  const checking = useRef(false);

  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [camError, setCamError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [restart, setRestart] = useState(0);

  async function stopScanner() {
    if (scanner.current) {
      try {
        if (scanning.current) await scanner.current.stop();
      } catch {}
      try {
        await scanner.current.clear();
      } catch {}
    }
    scanner.current = null;
    scanning.current = false;
  }

  async function check(raw: string) {
    if (checking.current) return;

    const id = normalize(raw);

    if (!isPassId(id)) {
      setResult({
        success: false,
        notFound: true,
        id: id.slice(0, 40),
        message: "Invalid pass. This is not a VYRA pass.",
      });
      return;
    }

    checking.current = true;
    setBusy(true);
    setResult(null);

    try {
      const response = await scanPassWithGoogle(id);
      setResult(response);
      setManual("");
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Scanner error.",
      });
    } finally {
      checking.current = false;
      setBusy(false);
    }
  }

  async function startScanner() {
    await stopScanner();
    setCamError("");
    setResult(null);

    const s = new Html5Qrcode("qr-reader");
    scanner.current = s;

    try {
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (text) => {
          if (!scanning.current || checking.current) return;
          scanning.current = false;

          try {
            await s.stop();
          } catch {}

          await check(text);
        },
        () => {}
      );
      scanning.current = true;
    } catch (error) {
      console.error(error);
      setCamError(
        "Camera could not start. Allow camera permission or use Manual Pass ID."
      );
    }
  }

  useEffect(() => {
    void startScanner();
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restart]);

  let resultClass = "danger";
  if (result?.success) resultClass = "success";
  else if (result?.alreadyUsed) resultClass = "warning";

  return (
    <main className="app">
      <div className="bg" aria-hidden="true">
        <img className="bgl" src={logo} alt="" />
      </div>

      <section className="shell">
        <header>
          <img className="logo" src={logo} alt="VYRA Entertainment" />
          <div className="subline">ENTRY SCANNER</div>
          <div className="live">
            <i /> LIVE
          </div>
        </header>

        <section className="card">
          <div className="title">SCAN QR CODE</div>
          <p className="hint">Hold the pass QR inside the frame</p>

          <div className={"viewfinder" + (busy || result ? " paused" : "")}>
            <div id="qr-reader" className="reader" />
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
          </div>

          {camError && <div className="error">{camError}</div>}

          <div className="or">
            <span>OR</span>
          </div>

          <div className="manual">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void check(manual);
              }}
              placeholder="VYRA-AB12CD"
            />

            <button
              disabled={busy || !manual.trim()}
              onClick={() => void check(manual)}
            >
              {busy ? "CHECKING..." : "CHECK PASS"}
            </button>
          </div>
        </section>

        {result && (
          <section className={"result " + resultClass}>
            <div className="icon">
              {result.success ? "✓" : result.alreadyUsed ? "!" : "×"}
            </div>

            <div>
              <h2>
                {result.success
                  ? "VALID PASS"
                  : result.alreadyUsed
                    ? "ALREADY SCANNED"
                    : result.notFound
                      ? "INVALID PASS"
                      : "SCAN ERROR"}
              </h2>

              <p>{result.message}</p>

              {result.id && (
                <div className="details">
                  <div>
                    PASS ID
                    <strong>{result.id}</strong>
                  </div>

                  {result.name && (
                    <div>
                      GUEST
                      <strong>{result.name}</strong>
                    </div>
                  )}

                  {result.passType && (
                    <div>
                      TYPE
                      <strong>{result.passType}</strong>
                    </div>
                  )}

                  {result.alreadyUsed && result.scannedAt && (
                    <div>
                      FIRST SCANNED
                      <strong>{result.scannedAt}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <button
          className="next"
          onClick={() => {
            setResult(null);
            setManual("");
            setRestart((value) => value + 1);
          }}
        >
          SCAN NEXT PASS
        </button>

        <footer>VYRA ENTRY CONTROL · AUTHENTIC PASS VERIFICATION</footer>
      </section>
    </main>
  );
}
