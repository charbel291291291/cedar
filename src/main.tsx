import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

function dismissSplash() {
  const splash = document.getElementById("splash-screen");
  if (!splash) return;
  splash.setAttribute("aria-busy", "false");
  splash.classList.add("is-hiding");
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    splash.remove();
  };
  splash.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, 500);
}

requestAnimationFrame(() => {
  requestAnimationFrame(dismissSplash);
});
