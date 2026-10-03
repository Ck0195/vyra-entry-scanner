import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Result = {
  success?: boolean;
  alreadyUsed?: boolean;
  notFound?: boolean;
  id?: string;
  name?: string;
  passType?: string;
  message?: string;
};

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxlk_WisRENOqbdwxabb--s0T0C7iuQkd2Wi341KaGKy3pkhx0EoXi25gApAhsM3VvE/exec";


function normalize(value: string) {

  const raw =
    value.trim().toUpperCase();

  const match =
    raw.match(/PASS-[A-Z0-9_-]+/);

  return match
    ? match[0]
    : raw;
}


/* =========================
   CALL GOOGLE APPS SCRIPT
   USING JSONP
========================= */

function checkPassWithGoogle(
  passId: string
): Promise<Result> {

  return new Promise((resolve) => {

    const callbackName =
      "vyraScanner_" +
      Date.now() +
      "_" +
      Math.floor(
        Math.random() * 10000
      );

    const script =
      document.createElement("script");

    const timeout =
      window.setTimeout(() => {

        cleanup();

        resolve({
          success: false,
          message:
            "Scanner connection timed out."
        });

      }, 15000);


    function cleanup() {

      window.clearTimeout(timeout);

      delete (
        window as unknown as Record<
          string,
          unknown
        >
      )[callbackName];

      script.remove();
    }


    (
      window as unknown as Record<
        string,
        unknown
      >
    )[callbackName] = (
      response: Result
    ) => {

      cleanup();

      resolve(response);
    };


    const url =
      APPS_SCRIPT_URL +
      "?action=check" +
      "&passId=" +
      encodeURIComponent(passId) +
      "&callback=" +
      callbackName;


    script.src = url;

    script.onerror = () => {

      cleanup();

      resolve({
        success: false,
        message:
          "Could not connect to Google Sheets."
      });
    };


    document.body.appendChild(script);
  });
}


/* =========================
   APP
========================= */

export default function App() {

  const scanner =
    useRef<Html5Qrcode | null>(null);

  const scanning =
    useRef(false);

  const [manual, setManual] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [camError, setCamError] =
    useState("");

  const [result, setResult] =
    useState<Result | null>(null);

  const [restart, setRestart] =
    useState(0);


  /* =========================
     STOP CAMERA
  ========================= */

  async function stopScanner() {

    if (scanner.current) {

      try {

        if (scanning.current) {
          await scanner.current.stop();
        }

      } catch {}

      try {
        await scanner.current.clear();
      } catch {}
    }

    scanner.current = null;
    scanning.current = false;
  }


  /* =========================
     CHECK PASS
  ========================= */

  async function check(raw: string) {

    const id =
      normalize(raw);

    if (
      !id ||
      !id.startsWith("PASS-")
    ) {

      setResult({
        success: false,
        notFound: true,
        message: "Invalid Pass ID."
      });

      return;
    }


    setBusy(true);
    setResult(null);


    try {

      const response =
        await checkPassWithGoogle(id);

      setResult(response);

      setManual("");

    } catch (error) {

      setResult({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Scanner error."
      });

    } finally {

      setBusy(false);
    }
  }


  /* =========================
     START CAMERA
  ========================= */

  async function startScanner() {

    await stopScanner();

    setCamError("");
    setResult(null);


    const s =
      new Html5Qrcode(
        "qr-reader"
      );

    scanner.current = s;


    try {

      await s.start(

        {
          facingMode: {
            exact: "environment"
          }
        },

        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250
          }
        },

        async (text) => {

          if (
            !scanning.current ||
            busy
          ) {
            return;
          }

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

  }, [restart]);


  /* =========================
     RESULT STYLE
  ========================= */

  let resultClass = "danger";

  if (result?.success) {
    resultClass = "success";
  } else if (result?.alreadyUsed) {
    resultClass = "warning";
  }


  return (

    <main className="app">

      <section className="shell">

        <header>

          <div>

            <div className="eyebrow">
              VYRA ENTERTAINMENT
            </div>

            <h1>
              ENTRY SCANNER
            </h1>

            <p>
              Scan a guest pass to approve entry.
            </p>

          </div>

          <div className="live">
            ● LIVE
          </div>

        </header>


        <section className="card">

          <div className="title">
            SCAN QR CODE
          </div>


          <div
            id="qr-reader"
            className="reader"
          />


          {camError && (

            <div className="error">
              {camError}
            </div>

          )}


          <div className="or">
            <span>OR</span>
          </div>


          <div className="manual">

            <input
              value={manual}
              onChange={(e) =>
                setManual(e.target.value)
              }
              onKeyDown={(e) => {

                if (e.key === "Enter") {
                  void check(manual);
                }

              }}
              placeholder="PASS-EC49B6BB"
            />


            <button
              disabled={
                busy ||
                !manual.trim()
              }
              onClick={() =>
                void check(manual)
              }
            >
              {busy
                ? "CHECKING..."
                : "CHECK PASS"}
            </button>

          </div>

        </section>


        {result && (

          <section
            className={
              "result " +
              resultClass
            }
          >

            <div className="icon">

              {result.success
                ? "✓"
                : result.alreadyUsed
                  ? "!"
                  : "×"}

            </div>


            <div>

              <h2>

                {result.success
                  ? "APPROVED"
                  : result.alreadyUsed
                    ? "ALREADY CHECKED IN"
                    : result.notFound
                      ? "INVALID PASS"
                      : "SCAN ERROR"}

              </h2>


              <p>
                {result.message}
              </p>


              {result.id && (

                <div className="details">

                  <div>
                    PASS ID
                    <strong>
                      {result.id}
                    </strong>
                  </div>


                  {result.name && (

                    <div>
                      GUEST
                      <strong>
                        {result.name}
                      </strong>
                    </div>

                  )}


                  {result.passType && (

                    <div>
                      TYPE
                      <strong>
                        {result.passType}
                      </strong>
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
            setRestart(
              (value) => value + 1
            );

          }}
        >
          SCAN NEXT PASS
        </button>


        <footer>
          VYRA ENTRY CONTROL · AUTHENTIC PASS VERIFICATION
        </footer>

      </section>

    </main>
  );
}